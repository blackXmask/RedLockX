import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, ShieldAlert, Cpu, AlertTriangle, ArrowRight, Zap, Info } from "lucide-react";
import { useAnalyzePrompt } from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000, "Prompt is too long"),
});

export default function Analyzer() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
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
        <p className="text-muted-foreground">Test prompts against the firewall's threat intelligence models.</p>
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
                Submit a prompt to evaluate its risk score and potential payload type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      "Analyzing..."
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
            <AlertTitle className="text-foreground">Engine Status: Online</AlertTitle>
            <AlertDescription className="text-xs mt-2 font-mono">
              Heuristic rules: v4.2.1 <br/>
              ML classifier: ACTIVE (Confidence: High)
            </AlertDescription>
          </Alert>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            Analysis Results
            <Badge variant="secondary" className="font-mono text-xs">{results.length}</Badge>
          </h3>
          
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
            {results.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50">
                <Cpu className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  Awaiting input. Submit a prompt to view real-time analysis results.
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

function ResultCard({ result, isLatest }: { result: AnalysisResult; isLatest: boolean }) {
  const isBlock = result.verdict === "BLOCK";
  
  return (
    <Card className={`border-l-4 transition-all duration-500 animate-in fade-in slide-in-from-right-4 ${isBlock ? 'border-l-destructive shadow-[0_0_15px_rgba(255,51,102,0.1)]' : 'border-l-success shadow-[0_0_15px_rgba(0,255,102,0.05)]'} ${isLatest ? 'ring-1 ring-border' : 'opacity-80 hover:opacity-100'}`}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            {isBlock ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <Shield className="h-5 w-5 text-success" />
            )}
            <span className={isBlock ? "text-destructive font-bold tracking-widest" : "text-success font-bold tracking-widest"}>
              {result.verdict}
            </span>
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            ID: {result.id} • {new Date(result.createdAt).toLocaleTimeString()}
          </CardDescription>
        </div>
        {result.attackType && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 uppercase tracking-wider font-mono">
            {result.attackType}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-background rounded p-3 text-sm font-mono text-muted-foreground border border-border">
          {result.explanation}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground uppercase">Risk Score</span>
              <span className={result.riskScore > 70 ? "text-destructive font-mono font-bold" : "font-mono font-bold"}>{result.riskScore}%</span>
            </div>
            <Progress value={result.riskScore} className="h-1.5" indicatorClassName={isBlock ? "bg-destructive" : "bg-success"} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground uppercase">ML Confidence</span>
              <span className="font-mono font-bold">{result.mlConfidence}%</span>
            </div>
            <Progress value={result.mlConfidence} className="h-1.5" indicatorClassName="bg-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
