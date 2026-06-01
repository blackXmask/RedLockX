import { Router } from "express";
import { db } from "@workspace/db";
import { analysisLogsTable } from "@workspace/db";
import { AnalyzePromptBody } from "@workspace/api-zod";

const router = Router();

const HYBRID_BASE =
  "https://blackxmask-redlockx-hybrid-prompt-detector-space-v2.hf.space";
const ML_BASE =
  "https://blackxmask-redlockx-ml-deberta-v3-prompt-detector-space.hf.space";

interface MlAttackType {
  label: string;
  score: number;
}

interface MlData {
  status: string;
  confidence: number;
  binary_confidence?: number;
  attack_type?: MlAttackType;
  attack_family?: { label: string; score: number };
  trigger_words?: string[];
}

/**
 * Call a Gradio 6 event-stream endpoint.
 * 1. POST /gradio_api/call/{fn} with {"data": [...]} → get event_id
 * 2. GET  /gradio_api/call/{fn}/{event_id} → SSE stream, wait for "complete"
 */
async function gradioCall(
  baseUrl: string,
  fn: string,
  data: unknown[]
): Promise<unknown[]> {
  const postRes = await fetch(`${baseUrl}/gradio_api/call/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!postRes.ok) {
    throw new Error(`Gradio submit failed: ${postRes.status}`);
  }

  const { event_id } = (await postRes.json()) as { event_id: string };

  const sseRes = await fetch(
    `${baseUrl}/gradio_api/call/${fn}/${event_id}`,
    { signal: AbortSignal.timeout(30_000) }
  );

  if (!sseRes.ok || !sseRes.body) {
    throw new Error(`Gradio stream failed: ${sseRes.status}`);
  }

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEventName = "";
  let resultData: unknown[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        lastEventName = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (lastEventName === "complete") {
          resultData = JSON.parse(raw) as unknown[];
          reader.cancel();
          return resultData;
        } else if (lastEventName === "error") {
          throw new Error(`Gradio error: ${raw}`);
        }
      }
    }
  }

  if (resultData.length > 0) return resultData;
  throw new Error("Gradio stream ended without a complete event");
}

async function callHybridSpace(prompt: string) {
  // Returns: [verdict_str, risk_percent_str, cosine_similarity_str]
  const result = await gradioCall(HYBRID_BASE, "detect", [prompt]);
  const verdictStr = String(result[0] ?? "");
  const riskStr = String(result[1] ?? "0");

  const riskMatch = riskStr.match(/[\d.]+/);
  const riskPercent = riskMatch ? parseFloat(riskMatch[0]) : 0;

  const isSafe = !verdictStr.toUpperCase().includes("MALICIOUS");

  return {
    verdictStr,
    riskPercent,
    isSafe,
  };
}

async function callMlSpace(prompt: string): Promise<MlData> {
  // Returns: [status_msg, json_output_str, html_output_str]
  // Python logic: result[1] is the JSON string when len >= 3
  const result = await gradioCall(ML_BASE, "detect", [prompt]);

  let rawOutput: unknown;
  if (Array.isArray(result) && result.length >= 3) {
    rawOutput = result[1];
  } else if (Array.isArray(result) && result.length === 2) {
    rawOutput = result[0];
  } else {
    rawOutput = result[0] ?? {};
  }

  if (typeof rawOutput === "string") {
    return JSON.parse(rawOutput) as MlData;
  }
  return rawOutput as MlData;
}

function buildExplanation(
  verdict: string,
  riskPercent: number,
  mlData: MlData
): string {
  const attackLabel =
    mlData.attack_type?.label?.replace(/_/g, " ") ?? "unknown pattern";
  const attackScore = mlData.attack_type?.score ?? 0;
  const triggerWords = mlData.trigger_words?.join(", ");

  if (verdict === "BLOCK") {
    let msg = `This prompt was flagged as malicious. The hybrid model detected a ${riskPercent.toFixed(1)}% injection risk, and the DeBERTa model classified it as DANGEROUS with ${(mlData.confidence * 100).toFixed(1)}% confidence. Primary attack pattern: ${attackLabel} (${(attackScore * 100).toFixed(1)}% match).`;
    if (triggerWords) {
      msg += ` Trigger words detected: ${triggerWords}.`;
    }
    return msg;
  }
  return `This prompt appears safe. The hybrid model detected a low injection risk of ${riskPercent.toFixed(1)}%, and the DeBERTa model classified it as SAFE with ${(mlData.confidence * 100).toFixed(1)}% confidence. No significant injection patterns were detected.`;
}

router.post("/analyze", async (req, res) => {
  const parsed = AnalyzePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt } = parsed.data;

  if (prompt.trim().length === 0) {
    res.status(400).json({ error: "Prompt cannot be empty" });
    return;
  }

  let hybridResult: Awaited<ReturnType<typeof callHybridSpace>>;
  let mlData: MlData;

  try {
    [hybridResult, mlData] = await Promise.all([
      callHybridSpace(prompt),
      callMlSpace(prompt),
    ]);
  } catch (err) {
    req.log.error({ err }, "HuggingFace Space call failed");
    res.status(502).json({
      error:
        "Unable to reach the detection models. The spaces may be sleeping — please try again in a few seconds.",
    });
    return;
  }

  const isAttack = !hybridResult.isSafe || mlData.status === "DANGEROUS";
  const verdict = isAttack ? "BLOCK" : "ALLOW";

  // Weighted blend: 0.6 × hybrid_risk + 0.4 × ml_confidence (when DANGEROUS)
  const mlWeight = mlData.status === "DANGEROUS" ? mlData.confidence : 0;
  const riskScore = Math.min(
    100,
    Math.max(0, 0.6 * hybridResult.riskPercent + 0.4 * mlWeight * 100)
  );

  const attackType = isAttack
    ? (mlData.attack_type?.label ?? "prompt_injection")
    : null;

  const explanation = buildExplanation(verdict, hybridResult.riskPercent, mlData);

  try {
    const [inserted] = await db
      .insert(analysisLogsTable)
      .values({
        prompt,
        verdict,
        riskScore,
        isSafe: !isAttack,
        attackType,
        hybridProbability: hybridResult.riskPercent / 100,
        mlStatus: mlData.status,
        mlConfidence: mlData.confidence,
        explanation,
      })
      .returning();

    if (!inserted) {
      res.status(500).json({ error: "Failed to store result" });
      return;
    }

    res.json({
      id: inserted.id,
      verdict: inserted.verdict,
      riskScore: inserted.riskScore,
      isSafe: inserted.isSafe,
      attackType: inserted.attackType,
      hybridProbability: inserted.hybridProbability,
      mlStatus: inserted.mlStatus,
      mlConfidence: inserted.mlConfidence,
      explanation: inserted.explanation,
      createdAt: inserted.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to store analysis result");
    res.status(500).json({ error: "Failed to store result" });
  }
});

export default router;
