import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  ShieldAlert,
  Cpu,
  ArrowRight,
  Zap,
  Info,
  CircleCheck,
  CircleX,
  GitMerge,
  BrainCircuit,
  Network,
} from "lucide-react";
import { useAnalyzePrompt } from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(10000, "Prompt is too long"),
});

export default function Analyzer() {
  const [results, setResults] = useState<AnalysisResult[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "" },
  });

  const analyzePrompt = useAnalyzePrompt();

  function onSubmit(values: z.infer<typeof formSchema>) {
    analyzePrompt.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setResults((prev) => [data, ...prev]);
          form.reset();
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analyzer</h2>
        <p className="text-muted-foreground">
          Test prompts against the firewall's threat intelligence models.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Real-time Analysis
              </CardTitle>
              <CardDescription>
                Submit a prompt to evaluate its risk score and potential payload
                type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Enter prompt to analyze..."
                            className="min-h-[200px] font-mono text-sm resize-none bg-background focus-visible:ring-primary"
                            {...field}
                            data-testid="input-prompt"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full font-bold tracking-wide uppercase"
                    disabled={analyzePrompt.isPending}
                    data-testid="button-analyze"
                  >
                    {analyzePrompt.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-pulse">Running models</span>
                        <span className="font-mono text-xs opacity-70">
                          parallel
                        </span>
                      </span>
                    ) : (
                      <>
                        Analyze Prompt
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Alert className="bg-secondary border-border text-muted-foreground">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground">
              Engine Status: Online
            </AlertTitle>
            <AlertDescription className="text-xs mt-2 font-mono space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                Hybrid Layer — XGBoost + MiniLM Embeddings
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                ML Layer — DeBERTa-v3 Classifier
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            Analysis Results
            <Badge variant="secondary" className="font-mono text-xs">
              {results.length}
            </Badge>
          </h3>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
            {results.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50">
                <Cpu className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  Awaiting input. Submit a prompt to view real-time analysis
                  results.
                </p>
              </div>
            )}

            {results.map((result, i) => (
              <ResultCard key={result.id || i} result={result} isLatest={i === 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  isLatest,
}: {
  result: AnalysisResult;
  isLatest: boolean;
}) {
  const isBlock = result.verdict === "BLOCK";
  const hybridRisk = result.hybridProbability * 100;
  const mlConfidencePct = result.mlConfidence * 100;
  const hybridMalicious = hybridRisk > 50;
  const mlDangerous = result.mlStatus === "DANGEROUS";

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-right-4 ${
        isBlock
          ? "border-destructive/40 shadow-[0_0_20px_rgba(255,51,102,0.08)]"
          : "border-green-600/30 shadow-[0_0_20px_rgba(0,200,100,0.05)]"
      } ${isLatest ? "" : "opacity-75 hover:opacity-100"}`}
    >
      {/* ── Final Verdict Banner ─────────────────────────────── */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          isBlock
            ? "bg-destructive/10 border-b border-destructive/30"
            : "bg-green-950/40 border-b border-green-700/30"
        }`}
      >
        <div className="flex items-center gap-3">
          {isBlock ? (
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
          ) : (
            <Shield className="h-5 w-5 text-green-400 shrink-0" />
          )}
          <div>
            <div
              className={`text-lg font-black tracking-widest ${
                isBlock ? "text-destructive" : "text-green-400"
              }`}
            >
              {result.verdict}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              ID #{result.id} &middot;{" "}
              {new Date(result.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div
            className={`text-2xl font-black font-mono tabular-nums ${
              result.riskScore > 70
                ? "text-destructive"
                : result.riskScore > 30
                ? "text-yellow-400"
                : "text-green-400"
            }`}
          >
            {result.riskScore.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">
              %
            </span>
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Risk Score
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 bg-card">
        {/* ── Two-column model breakdown ───────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Hybrid Layer */}
          <div
            className={`rounded border p-3 space-y-2 ${
              hybridMalicious
                ? "border-destructive/30 bg-destructive/5"
                : "border-green-700/30 bg-green-950/20"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Network className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hybrid Layer
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono opacity-70 -mt-1">
              XGBoost + MiniLM
            </div>

            <div className="flex items-center gap-1.5">
              {hybridMalicious ? (
                <CircleX className="h-3.5 w-3.5 text-destructive shrink-0" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5 text-green-400 shrink-0" />
              )}
              <span
                className={`text-sm font-bold ${
                  hybridMalicious ? "text-destructive" : "text-green-400"
                }`}
              >
                {hybridMalicious ? "MALICIOUS" : "SAFE"}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Risk</span>
                <span className="font-mono font-bold tabular-nums">
                  {hybridRisk.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={hybridRisk}
                className="h-1"
              />
            </div>
          </div>

          {/* ML Layer */}
          <div
            className={`rounded border p-3 space-y-2 ${
              mlDangerous
                ? "border-destructive/30 bg-destructive/5"
                : "border-green-700/30 bg-green-950/20"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <BrainCircuit className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ML Layer
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono opacity-70 -mt-1">
              DeBERTa-v3
            </div>

            <div className="flex items-center gap-1.5">
              {mlDangerous ? (
                <CircleX className="h-3.5 w-3.5 text-destructive shrink-0" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5 text-green-400 shrink-0" />
              )}
              <span
                className={`text-sm font-bold ${
                  mlDangerous ? "text-destructive" : "text-green-400"
                }`}
              >
                {result.mlStatus}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-mono font-bold tabular-nums">
                  {mlConfidencePct.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={mlConfidencePct}
                className="h-1"
              />
            </div>
          </div>
        </div>

        {/* ── Attack type + decision logic ─────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitMerge className="h-3.5 w-3.5 shrink-0" />
            <span className="uppercase tracking-wide">Decision</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            risk &gt; 50% OR ml = DANGEROUS
          </span>
          <span className="ml-auto">
            {result.attackType ? (
              <Badge
                variant="outline"
                className="bg-destructive/10 text-destructive border-destructive/20 uppercase tracking-wider font-mono text-xs"
              >
                {result.attackType.replace(/_/g, " ")}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-green-950/30 text-green-400 border-green-700/30 font-mono text-xs"
              >
                no attack detected
              </Badge>
            )}
          </span>
        </div>

        {/* ── Explanation ──────────────────────────────────── */}
        <div className="bg-background rounded border border-border p-3 text-xs font-mono text-muted-foreground leading-relaxed">
          {result.explanation}
        </div>
      </div>
    </div>
  );
}
