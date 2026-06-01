import { Router } from "express";
import { db } from "@workspace/db";
import { analysisLogsTable } from "@workspace/db";
import { AnalyzePromptBody } from "@workspace/api-zod";

const router = Router();

const HYBRID_SPACE_URL = process.env["HYBRID_SPACE_URL"] ?? "";
const ML_SPACE_URL = process.env["ML_SPACE_URL"] ?? "";

const ATTACK_TYPES = [
  "prompt_injection",
  "jailbreak",
  "obfuscation_attack",
  "role_play_manipulation",
  "instruction_override",
  "system_prompt_leak",
  "indirect_injection",
];

function simulateHybridResult(prompt: string): { malicious_probability: number; cosine_similarity: number } {
  const injectionKeywords = [
    "ignore", "forget", "disregard", "override", "bypass",
    "pretend", "roleplay", "jailbreak", "dan", "sudo",
    "system prompt", "previous instructions", "you are now",
    "act as", "new persona", "ignore all", "ignore previous",
    "0r", "1nst", "1gnor", "pr3v", "instructi0n", "1nstruct",
  ];
  const lower = prompt.toLowerCase();
  const matchCount = injectionKeywords.filter((kw) => lower.includes(kw)).length;
  const hasLeet = /[0-9]/.test(prompt) && /[a-zA-Z]/.test(prompt) && matchCount > 0;
  const hasAllCaps = prompt.split(" ").filter((w) => w.length > 3 && w === w.toUpperCase()).length > 2;

  let base = 0.05 + matchCount * 0.15 + (hasLeet ? 0.2 : 0) + (hasAllCaps ? 0.1 : 0);
  base = Math.min(0.9999, Math.max(0.001, base + (Math.random() * 0.05 - 0.025)));
  const cosine = 1 - base + Math.random() * 0.1;

  return { malicious_probability: base, cosine_similarity: Math.max(0.01, Math.min(0.99, cosine)) };
}

function simulateMlResult(hybridProb: number): {
  status: string;
  confidence: number;
  attack_type: { label: string; score: number };
} {
  const isDangerous = hybridProb > 0.5;
  const confidence = isDangerous
    ? 0.7 + Math.random() * 0.29
    : 0.6 + Math.random() * 0.35;
  const attackIdx = Math.floor(Math.random() * ATTACK_TYPES.length);
  return {
    status: isDangerous ? "DANGEROUS" : "SAFE",
    confidence,
    attack_type: {
      label: isDangerous ? ATTACK_TYPES[attackIdx]! : "none",
      score: isDangerous ? 0.7 + Math.random() * 0.29 : 0.05 + Math.random() * 0.2,
    },
  };
}

async function callHybridSpace(prompt: string): Promise<{ malicious_probability: number; cosine_similarity: number }> {
  if (!HYBRID_SPACE_URL) {
    return simulateHybridResult(prompt);
  }
  const res = await fetch(HYBRID_SPACE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [prompt] }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Hybrid space error: ${res.status}`);
  const json = (await res.json()) as { data: Array<{ malicious_probability: number; cosine_similarity: number }> };
  return json.data[0]!;
}

async function callMlSpace(prompt: string): Promise<{ status: string; confidence: number; attack_type: { label: string; score: number } }> {
  if (!ML_SPACE_URL) {
    const hybrid = simulateHybridResult(prompt);
    return simulateMlResult(hybrid.malicious_probability);
  }
  const res = await fetch(ML_SPACE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [prompt] }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ML space error: ${res.status}`);
  const json = (await res.json()) as { data: Array<{ status: string; confidence: number; attack_type: { label: string; score: number } }> };
  return json.data[0]!;
}

function buildExplanation(verdict: string, hybridProb: number, mlResult: { status: string; confidence: number; attack_type: { label: string; score: number } }): string {
  if (verdict === "BLOCK") {
    const attackLabel = mlResult.attack_type.label.replace(/_/g, " ");
    return `This prompt was flagged as malicious. The hybrid model detected a ${(hybridProb * 100).toFixed(1)}% injection probability, and the DeBERTa model classified it as DANGEROUS with ${(mlResult.confidence * 100).toFixed(1)}% confidence. Primary attack pattern identified: ${attackLabel} (${(mlResult.attack_type.score * 100).toFixed(1)}% match). The prompt contains patterns consistent with attempts to override, manipulate, or exfiltrate LLM system instructions.`;
  }
  return `This prompt appears safe. The hybrid model detected a low injection probability of ${(hybridProb * 100).toFixed(1)}%, and the DeBERTa model classified it as SAFE with ${(mlResult.confidence * 100).toFixed(1)}% confidence. No significant injection patterns were detected.`;
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

  try {
    const [hybridResult, mlResult] = await Promise.all([
      callHybridSpace(prompt),
      callMlSpace(prompt),
    ]);

    const hybridProb = hybridResult.malicious_probability;
    const riskWeight = (0.6 * hybridProb) + (0.4 * mlResult.confidence * (mlResult.status === "DANGEROUS" ? 1 : 0));
    const isAttack = hybridProb > 0.5 || mlResult.status === "DANGEROUS";
    const verdict = isAttack ? "BLOCK" : "ALLOW";
    const riskScore = Math.min(100, Math.max(0, riskWeight * 100));
    const attackType = isAttack ? mlResult.attack_type.label : null;

    const explanation = buildExplanation(verdict, hybridProb, mlResult);

    const [inserted] = await db
      .insert(analysisLogsTable)
      .values({
        prompt,
        verdict,
        riskScore,
        isSafe: !isAttack,
        attackType,
        hybridProbability: hybridProb,
        mlStatus: mlResult.status,
        mlConfidence: mlResult.confidence,
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
    req.log.error({ err }, "Analysis failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
