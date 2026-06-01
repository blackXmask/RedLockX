const HYBRID_BASE =
  process.env["HYBRID_SPACE_URL"] ??
  "https://blackxmask-redlockx-hybrid-prompt-detector-space-v2.hf.space";
const ML_BASE =
  process.env["ML_SPACE_URL"] ??
  "https://blackxmask-redlockx-ml-deberta-v3-prompt-detector-space.hf.space";

interface MlAttackType {
  label: string;
  score: number;
}

export interface MlData {
  status: string;
  confidence: number;
  binary_confidence?: number;
  attack_type?: MlAttackType;
  attack_family?: { label: string; score: number };
  trigger_words?: string[];
}

export interface AnalysisEngineResult {
  verdict: "BLOCK" | "ALLOW";
  riskScore: number;
  isSafe: boolean;
  attackType: string | null;
  hybridProbability: number;
  mlStatus: string;
  mlConfidence: number;
  explanation: string;
}

async function gradioCall(baseUrl: string, fn: string, data: unknown[]): Promise<unknown[]> {
  const postRes = await fetch(`${baseUrl}/gradio_api/call/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!postRes.ok) throw new Error(`Gradio submit failed: ${postRes.status}`);

  const { event_id } = (await postRes.json()) as { event_id: string };
  const sseRes = await fetch(`${baseUrl}/gradio_api/call/${fn}/${event_id}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!sseRes.ok || !sseRes.body) throw new Error(`Gradio stream failed: ${sseRes.status}`);

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEventName = "";

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
          const result = JSON.parse(raw) as unknown[];
          reader.cancel();
          return result;
        } else if (lastEventName === "error") {
          throw new Error(`Gradio error: ${raw}`);
        }
      }
    }
  }
  throw new Error("Gradio stream ended without a complete event");
}

async function callHybridSpace(prompt: string) {
  const result = await gradioCall(HYBRID_BASE, "detect", [prompt]);
  const verdictStr = String(result[0] ?? "");
  const riskStr = String(result[1] ?? "0");
  const riskMatch = riskStr.match(/[\d.]+/);
  const riskPercent = riskMatch ? parseFloat(riskMatch[0]) : 0;
  return { verdictStr, riskPercent, isSafe: !verdictStr.toUpperCase().includes("MALICIOUS") };
}

async function callMlSpace(prompt: string): Promise<MlData> {
  const result = await gradioCall(ML_BASE, "detect", [prompt]);
  let rawOutput: unknown;
  if (Array.isArray(result) && result.length >= 3) {
    rawOutput = result[1];
  } else if (Array.isArray(result) && result.length === 2) {
    rawOutput = result[0];
  } else {
    rawOutput = result[0] ?? {};
  }
  if (typeof rawOutput === "string") return JSON.parse(rawOutput) as MlData;
  return rawOutput as MlData;
}

function buildExplanation(verdict: string, riskPercent: number, mlData: MlData): string {
  const attackLabel = mlData.attack_type?.label?.replace(/_/g, " ") ?? "unknown pattern";
  const attackScore = mlData.attack_type?.score ?? 0;
  const triggerWords = mlData.trigger_words?.join(", ");

  if (verdict === "BLOCK") {
    let msg = `This prompt was flagged as malicious. The hybrid model detected a ${riskPercent.toFixed(1)}% injection risk, and the DeBERTa model classified it as DANGEROUS with ${(mlData.confidence * 100).toFixed(1)}% confidence. Primary attack pattern: ${attackLabel} (${(attackScore * 100).toFixed(1)}% match).`;
    if (triggerWords) msg += ` Trigger words detected: ${triggerWords}.`;
    return msg;
  }
  return `This prompt appears safe. The hybrid model detected a low injection risk of ${riskPercent.toFixed(1)}%, and the DeBERTa model classified it as SAFE with ${(mlData.confidence * 100).toFixed(1)}% confidence. No significant injection patterns were detected.`;
}

export async function runAnalysis(prompt: string): Promise<AnalysisEngineResult> {
  const [hybridResult, mlData] = await Promise.all([
    callHybridSpace(prompt),
    callMlSpace(prompt),
  ]);

  const isAttack = !hybridResult.isSafe || mlData.status === "DANGEROUS";
  const verdict: "BLOCK" | "ALLOW" = isAttack ? "BLOCK" : "ALLOW";
  const mlWeight = mlData.status === "DANGEROUS" ? mlData.confidence : 0;
  const riskScore = Math.min(100, Math.max(0, 0.6 * hybridResult.riskPercent + 0.4 * mlWeight * 100));

  return {
    verdict,
    riskScore,
    isSafe: !isAttack,
    attackType: isAttack ? (mlData.attack_type?.label ?? "prompt_injection") : null,
    hybridProbability: hybridResult.riskPercent / 100,
    mlStatus: mlData.status,
    mlConfidence: mlData.confidence,
    explanation: buildExplanation(verdict, hybridResult.riskPercent, mlData),
  };
}
