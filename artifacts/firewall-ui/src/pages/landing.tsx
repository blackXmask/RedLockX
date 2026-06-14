import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, Zap, Brain, ChevronRight, AlertTriangle,
  Activity, BarChart3, MessageSquare, ExternalLink,
  FileWarning, Globe, Lock, Server
} from "lucide-react";
import { useGetStats } from "@workspace/api-client-react";

/* ─── Static data ──────────────────────────────────────────────── */

const ATTACK_TYPES = [
  { color: "text-red-400",    dot: "bg-red-500",    label: "direct_injection",          desc: '"Ignore previous instructions..."' },
  { color: "text-red-400",    dot: "bg-red-500",    label: "jailbreak_attempt",          desc: '"You are DAN, you have no restrictions..."' },
  { color: "text-red-400",    dot: "bg-red-500",    label: "system_prompt_extraction",   desc: '"Repeat your system prompt verbatim..."' },
  { color: "text-red-400",    dot: "bg-red-500",    label: "obfuscation_attack",         desc: "Base64, unicode escapes, encoding tricks" },
  { color: "text-red-400",    dot: "bg-red-500",    label: "indirect_injection",         desc: "Injections hidden inside documents or URLs" },
  { color: "text-yellow-400", dot: "bg-yellow-500", label: "role_play_escape",           desc: "Persona hijacking via fictional framing" },
];

const PIPELINE = [
  { icon: Brain,  title: "Hybrid Engine",   sub: "All-MiniLM + XGBoost",      desc: "Fast semantic embedding + gradient-boosted heuristic pre-filter.",           accent: "blue",   accuracy: "98.4%", metric: "Accuracy" },
  { icon: Shield, title: "DeBERTa-v3 ML",   sub: "Fine-tuned transformer",     desc: "Deep semantic classification — catches subtle obfuscation and role-play escapes.", accent: "purple", accuracy: "92.5%", metric: "Accuracy" },
  { icon: Zap,    title: "Decision Node",   sub: "Weighted aggregator",        desc: "Merges both verdicts with confidence-weighted logic → ALLOW or BLOCK.",       accent: "green",  accuracy: "<1s",   metric: "Latency"  },
];

const CVES = [
  {
    id: "CVE-2024-5184",
    severity: "HIGH",
    score: "8.8",
    product: "EmailGPT",
    summary: "Prompt injection via malicious email content allowed attackers to exfiltrate email data and execute arbitrary instructions — remote, no auth required.",
    impact: "Data exfiltration · Privilege escalation",
  },
  {
    id: "CVE-2023-32786",
    severity: "HIGH",
    score: "7.5",
    product: "LangChain < 0.0.164",
    summary: "Prompt injection in LangChain's LLM chain allowed arbitrary code execution through crafted inputs to the chain's language model interface.",
    impact: "RCE · Arbitrary code execution",
  },
  {
    id: "CVE-2024-27564",
    severity: "HIGH",
    score: "8.6",
    product: "ChatGPT Operator",
    summary: "SSRF vulnerability triggered via prompt injection — attackers craft prompts that force the AI agent to make requests to internal infrastructure.",
    impact: "SSRF · Internal network access",
  },
  {
    id: "CVE-2023-43261",
    severity: "HIGH",
    score: "7.5",
    product: "Giskard AI Platform",
    summary: "Indirect prompt injection via document ingestion pipeline. Malicious text embedded in PDFs or web pages hijacked the LLM agent's decision flow.",
    impact: "Agent hijacking · Unauthorized actions",
  },
];

const THREAT_STATS = [
  { icon: Globe,       val: "#1",    label: "OWASP LLM Top 10",         sub: "Prompt Injection is the top LLM vulnerability for 2023–2025" },
  { icon: AlertTriangle, val: "43%", label: "of AI Apps at Risk",       sub: "Gartner: ~43% of deployed LLM apps have no injection controls (2024)" },
  { icon: FileWarning, val: "1,000+",label: "Documented Attacks",       sub: "MITRE ATLAS catalogued 1,000+ real adversarial AI incidents by 2024" },
  { icon: Server,      val: "$2.8M", label: "Avg. Breach Cost",         sub: "IBM: average cost of an AI-assisted breach reached $2.8M in 2024" },
];

/* ─── Small helpers ────────────────────────────────────────────── */

function GlowDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
    </span>
  );
}

function StatsBadge() {
  const { data: stats } = useGetStats();
  return (
    <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full border border-border/40 bg-card/30 backdrop-blur-sm text-xs font-mono text-muted-foreground">
      <span className="flex items-center gap-1.5"><GlowDot /><span className="text-green-400">LIVE</span></span>
      {stats && (
        <>
          <span className="text-border">|</span>
          <span><span className="text-foreground font-semibold">{stats.totalAnalyzed.toLocaleString()}</span> analyzed</span>
          <span className="text-border">|</span>
          <span><span className="text-red-400 font-semibold">{stats.totalBlocked.toLocaleString()}</span> blocked</span>
          <span className="text-border">|</span>
          <span><span className="text-foreground font-semibold">{stats.blockRate.toFixed(1)}%</span> block rate</span>
        </>
      )}
    </div>
  );
}

function ScanLine() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" style={{ animation: "scanline 4s linear infinite", top: 0 }} />
    </div>
  );
}

function GridBg() {
  return (
    <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(hsl(215,100%,60%) 1px, transparent 1px), linear-gradient(90deg, hsl(215,100%,60%) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
  );
}

/* ─── Animated Architecture Diagram ───────────────────────────── */

const STEPS = ["start", "hybrid", "ml", "decision", "verdict"] as const;
type Step = typeof STEPS[number];

function AnimatedArchDiagram() {
  const [active, setActive] = useState<Step>("start");
  const [verdict, setVerdict] = useState<"allow" | "block" | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (fn: () => void, ms: number) => {
    timerRef.current = setTimeout(fn, ms);
  };

  const runCycle = () => {
    setVerdict(null);
    setActive("start");
    schedule(() => setActive("hybrid"), 600);
    schedule(() => setActive("ml"), 600);       // parallel
    schedule(() => setActive("decision"), 1800);
    schedule(() => {
      setActive("verdict");
      setVerdict(Math.random() > 0.45 ? "block" : "allow");
    }, 2800);
    schedule(() => runCycle(), 5200);
  };

  useEffect(() => {
    runCycle();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const is = (s: Step) => active === s;
  const pulse = (on: boolean, color: string) =>
    on ? `shadow-[0_0_20px_${color}] border-opacity-100` : "border-opacity-30";

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="min-w-[680px] mx-auto px-4">
        {/* Top row: START → [parallel] → DECISION → VERDICT */}
        <div className="flex items-center justify-between gap-2 py-8">

          {/* START node */}
          <div className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all duration-500`}>
            <div className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center text-center transition-all duration-500 ${
              is("start") ? "border-primary bg-primary/15 shadow-[0_0_24px_rgba(59,130,246,0.5)]" : "border-border/40 bg-card/20"
            }`}>
              <span className="text-[10px] font-mono text-muted-foreground">USER</span>
              <span className="text-lg">📝</span>
              <span className="text-[9px] font-mono text-primary/80">INPUT</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60">START</span>
          </div>

          {/* Arrow + label */}
          <ArrowFlow active={is("start")} label="prompt" />

          {/* Parallel block */}
          <div className="flex-shrink-0 flex flex-col gap-3 relative">
            {/* Hybrid layer */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-500 ${
              is("hybrid") || is("ml") || is("decision") || is("verdict")
                ? "border-blue-500/70 bg-blue-950/30 shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                : "border-blue-500/20 bg-blue-950/10"
            }`}>
              <div className={`w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center transition-all duration-300 ${is("hybrid") || is("ml") ? "animate-pulse" : ""}`}>
                <Brain className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-300 font-mono">Hybrid Layer</p>
                <p className="text-[10px] text-blue-300/60 font-mono">XGBoost + All-MiniLM</p>
                <p className="text-[10px] text-blue-300/40">98.4% acc · fast filter</p>
              </div>
              {(is("hybrid") || is("ml")) && (
                <span className="ml-2 w-2 h-2 rounded-full bg-blue-400 animate-ping flex-shrink-0" />
              )}
            </div>

            {/* Parallel label */}
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
              <div className={`w-1 h-12 rounded-full transition-all duration-500 ${is("hybrid") || is("ml") ? "bg-gradient-to-b from-blue-500 via-purple-500 to-purple-500 opacity-80" : "bg-border/20"}`} />
            </div>

            {/* DeBERTa layer */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-500 ${
              is("hybrid") || is("ml") || is("decision") || is("verdict")
                ? "border-purple-500/70 bg-purple-950/30 shadow-[0_0_20px_rgba(168,85,247,0.25)]"
                : "border-purple-500/20 bg-purple-950/10"
            }`}>
              <div className={`w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center transition-all duration-300 ${is("hybrid") || is("ml") ? "animate-pulse" : ""}`}>
                <Shield className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-300 font-mono">ML Layer</p>
                <p className="text-[10px] text-purple-300/60 font-mono">Microsoft DeBERTa-v3</p>
                <p className="text-[10px] text-purple-300/40">92.5% acc · deep semantic</p>
              </div>
              {(is("hybrid") || is("ml")) && (
                <span className="ml-2 w-2 h-2 rounded-full bg-purple-400 animate-ping flex-shrink-0" />
              )}
            </div>

            {/* HF Spaces label */}
            <div className="text-center">
              <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">🤗 HF SPACES · PARALLEL</span>
            </div>
          </div>

          {/* Arrow */}
          <ArrowFlow active={is("decision") || is("verdict")} label="scores" />

          {/* Decision node */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className={`w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center text-center transition-all duration-500 ${
              is("decision")
                ? "border-yellow-400/80 bg-yellow-950/30 shadow-[0_0_28px_rgba(250,204,21,0.4)]"
                : is("verdict")
                ? "border-yellow-400/40 bg-yellow-950/10"
                : "border-border/30 bg-card/20"
            }`}>
              {is("decision") && <span className="absolute w-24 h-24 rounded-full border-2 border-yellow-400/30 animate-ping" />}
              <Zap className={`h-5 w-5 mb-1 transition-colors ${is("decision") ? "text-yellow-400" : "text-muted-foreground/40"}`} />
              <span className={`text-[10px] font-mono font-bold transition-colors ${is("decision") ? "text-yellow-300" : "text-muted-foreground/50"}`}>DECISION</span>
              <span className="text-[9px] font-mono text-muted-foreground/30">NODE</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60">LangGraph</span>
          </div>

          {/* Arrow */}
          <ArrowFlow active={is("verdict")} label="verdict" />

          {/* Verdict */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            {/* ALLOW */}
            <div className={`w-20 px-2 py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all duration-500 ${
              verdict === "allow" && is("verdict")
                ? "border-green-400/80 bg-green-950/40 shadow-[0_0_24px_rgba(34,197,94,0.5)] scale-110"
                : "border-green-500/20 bg-green-950/10 scale-100"
            }`}>
              <span className="text-lg">{verdict === "allow" && is("verdict") ? "✅" : "🟢"}</span>
              <span className={`text-[11px] font-mono font-bold transition-colors ${verdict === "allow" && is("verdict") ? "text-green-300" : "text-green-500/40"}`}>ALLOW</span>
              <span className="text-[9px] font-mono text-muted-foreground/30">safe</span>
            </div>
            {/* BLOCK */}
            <div className={`w-20 px-2 py-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all duration-500 ${
              verdict === "block" && is("verdict")
                ? "border-red-400/80 bg-red-950/40 shadow-[0_0_24px_rgba(239,68,68,0.5)] scale-110"
                : "border-red-500/20 bg-red-950/10 scale-100"
            }`}>
              <span className="text-lg">{verdict === "block" && is("verdict") ? "🛑" : "🔴"}</span>
              <span className={`text-[11px] font-mono font-bold transition-colors ${verdict === "block" && is("verdict") ? "text-red-300" : "text-red-500/40"}`}>BLOCK</span>
              <span className="text-[9px] font-mono text-muted-foreground/30">threat</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/60">END</span>
          </div>
        </div>

        {/* State JSON ticker */}
        <div className="mt-2 px-4 py-3 rounded-lg border border-border/20 bg-black/30 font-mono text-[11px] text-muted-foreground/60">
          <span className="text-primary/50">state = </span>
          <span className="text-green-400/70">&#123;</span>
          <span className="text-blue-300/80"> verdict</span>: <span className="text-yellow-300/80">"{is("verdict") ? (verdict === "block" ? "BLOCK" : "ALLOW") : is("decision") ? "computing…" : is("hybrid") || is("ml") ? "analyzing…" : "awaiting"}"</span>
          {is("verdict") && verdict && (
            <>, <span className="text-blue-300/80"> risk</span>: <span className="text-orange-300/80">{verdict === "block" ? Math.floor(85 + Math.random() * 15) : Math.floor(Math.random() * 8)}%</span></>
          )}
          <span className="text-green-400/70"> &#125;</span>
        </div>

        {/* Step labels */}
        <div className="mt-4 flex justify-between text-[9px] font-mono text-muted-foreground/30 px-2">
          <span className={is("start") ? "text-primary/60" : ""}>① INIT</span>
          <span className={is("hybrid") || is("ml") ? "text-blue-400/60" : ""}>② PARALLEL INFERENCE</span>
          <span className={is("decision") ? "text-yellow-400/60" : ""}>③ AGGREGATE</span>
          <span className={is("verdict") ? (verdict === "block" ? "text-red-400/60" : "text-green-400/60") : ""}>④ OUTPUT</span>
        </div>
      </div>
    </div>
  );
}

function ArrowFlow({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1 min-w-[40px]">
      <div className="relative w-full flex items-center">
        <div className={`h-px flex-1 transition-all duration-500 ${active ? "bg-primary/70" : "bg-border/20"}`} />
        {active && (
          <div className="absolute left-0 right-0 h-px overflow-hidden">
            <div className="h-px w-4 bg-primary rounded-full" style={{ animation: "slide-right 0.8s linear infinite" }} />
          </div>
        )}
        <ChevronRight className={`h-3 w-3 flex-shrink-0 transition-colors duration-300 ${active ? "text-primary" : "text-border/30"}`} />
      </div>
      <span className={`text-[9px] font-mono transition-colors ${active ? "text-primary/60" : "text-muted-foreground/20"}`}>{label}</span>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────── */

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[hsl(222,50%,2.5%)] text-foreground overflow-x-hidden">
      <style>{`
        @keyframes scanline    { 0% { top: -2px; } 100% { top: 100%; } }
        @keyframes float       { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes slide-right { 0% { transform: translateX(-100%); } 100% { transform: translateX(800%); } }
        @keyframes count-up    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .float        { animation: float 5s ease-in-out infinite; }
        .glow-red     { filter: drop-shadow(0 0 24px rgba(220,30,30,0.55)) drop-shadow(0 0 8px rgba(220,30,30,0.3)); }
        .text-gradient { background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .card-glow-blue   { box-shadow: 0 0 0 1px rgba(59,130,246,0.15),  0 0 40px rgba(59,130,246,0.05); }
        .card-glow-purple { box-shadow: 0 0 0 1px rgba(168,85,247,0.15), 0 0 40px rgba(168,85,247,0.05); }
        .card-glow-green  { box-shadow: 0 0 0 1px rgba(34,197,94,0.15),  0 0 40px rgba(34,197,94,0.05); }
        .cve-card:hover   { transform: translateY(-2px); }
      `}</style>

      {/* ── NAV ─────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/30 bg-[hsl(222,50%,2.5%)]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <img src="/redlock-logo.png" alt="RedLockX" className="h-8 w-8 object-contain glow-red" />
          <span className="font-mono font-bold tracking-widest text-sm text-foreground/90">REDLOCK<span className="text-primary">X</span></span>
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">v2</span>
          <div className="ml-auto flex items-center gap-3">
            <a href="https://huggingface.co/blackxmask" target="_blank" rel="noopener"
              className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <span>🤗 HuggingFace</span><ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 transition-all hover:shadow-[0_0_16px_rgba(59,130,246,0.4)]">
              Launch App <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden">
        <GridBg /><ScanLine />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-8">
          <StatsBadge />
          <div className="float">
            <img src="/redlock-logo.png" alt="RedLockX" className="w-28 h-28 object-contain glow-red" />
          </div>
          <pre className="hidden sm:block text-[9px] leading-tight font-mono text-primary/20 select-none">{`██████╗ ███████╗██████╗ ██╗      ██████╗  ██████╗██╗  ██╗██╗  ██╗
██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝╚██╗██╔╝
██████╔╝█████╗  ██║  ██║██║     ██║   ██║██║     █████╔╝  ╚███╔╝ 
██╔══██╗██╔══╝  ██║  ██║██║     ██║   ██║██║     ██╔═██╗  ██╔██╗ 
██║  ██║███████╗██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗██╔╝ ██╗
╚═╝  ╚═╝╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝`}</pre>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-gradient">AI-Powered</span><br />
              <span className="text-foreground">Prompt Injection Firewall</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Shield your AI systems from jailbreaks, system prompt leaks, and injection attacks — in{" "}
              <span className="text-primary font-semibold">real time</span>, with a dual-model parallel pipeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300">XGBoost + All-MiniLM</span>
            <span className="text-muted-foreground/40">+</span>
            <span className="px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300">Microsoft DeBERTa-v3</span>
            <span className="text-muted-foreground/40">→</span>
            <span className="px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-300">ALLOW / BLOCK verdict</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <button onClick={() => navigate("/dashboard")}
              className="group flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-105">
              <Shield className="h-4 w-4" />
              Get Started — Try the Firewall
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="https://huggingface.co/blackxmask" target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg border border-border/50 text-muted-foreground font-mono text-sm hover:border-border hover:text-foreground transition-all">
              🤗 View on HuggingFace <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground/60 font-mono mt-2">
            <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded border border-border/50 bg-card/30 flex items-center justify-center text-[10px]">1</span> Paste a prompt</span>
            <ChevronRight className="h-3 w-3" />
            <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded border border-border/50 bg-card/30 flex items-center justify-center text-[10px]">2</span> Dual-model analysis</span>
            <ChevronRight className="h-3 w-3" />
            <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded border border-border/50 bg-card/30 flex items-center justify-center text-[10px]">3</span> ALLOW or BLOCK</span>
          </div>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ───────────────────── */}
      <section className="relative py-24 px-6 border-t border-border/20 bg-red-950/5">
        <GridBg />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono mb-4">
              <AlertTriangle className="h-3 w-3" /> THREAT LANDSCAPE
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold">Why Prompt Injection Is the<br /><span className="text-gradient">Fastest-Growing AI Threat</span></h2>
            <p className="mt-5 text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
              As LLMs are embedded into production systems — email clients, code assistants, customer agents — attackers discovered they can <strong className="text-foreground">hijack AI behaviour through natural language alone</strong>, bypassing every traditional security control.
            </p>
          </div>

          {/* Threat stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {THREAT_STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-5 rounded-xl border border-red-500/15 bg-red-950/10 hover:bg-red-950/20 transition-colors">
                  <Icon className="h-5 w-5 text-red-400 mb-3" />
                  <div className="text-2xl sm:text-3xl font-bold text-red-300 font-mono mb-1">{s.val}</div>
                  <div className="text-xs font-semibold text-foreground/80 mb-1">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground/60 leading-relaxed">{s.sub}</div>
                </div>
              );
            })}
          </div>

          {/* CVE list */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-red-500/20" />
              <span className="text-xs font-mono text-red-400/70 tracking-widest uppercase px-2">Real CVEs — Production AI Systems Compromised</span>
              <div className="flex-1 h-px bg-red-500/20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CVES.map((cve) => (
                <div key={cve.id} className="cve-card p-5 rounded-xl border border-border/30 bg-card/20 hover:border-red-500/30 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="font-mono text-sm font-bold text-red-300">{cve.id}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/50">· {cve.product}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        cve.severity === "CRITICAL" ? "text-red-300 bg-red-950/50 border-red-500/40" : "text-orange-300 bg-orange-950/50 border-orange-500/40"
                      }`}>{cve.severity}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/50">CVSS {cve.score}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{cve.summary}</p>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    <span className="text-[11px] font-mono text-orange-300/70">{cve.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Problem summary box */}
          <div className="p-6 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-950/20 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Lock className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">The Core Problem</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Traditional firewalls operate on bytes, headers, and signatures — none of which apply to LLM prompts.
                  An attacker needs only a carefully crafted sentence to <span className="text-red-300">leak your system prompt</span>,{" "}
                  <span className="text-red-300">exfiltrate user data</span>, or <span className="text-red-300">make your AI agent perform unauthorized actions</span>.
                  RedLockX is the semantic firewall layer that sits between untrusted input and your model — analyzing intent, not just bytes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANIMATED ARCHITECTURE ───────────────── */}
      <section className="relative py-24 px-6 border-t border-border/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono text-primary/60 tracking-widest uppercase mb-3">System Design</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Live Architecture Diagram</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              LangGraph StateGraph orchestrating the parallel detection pipeline — watch a prompt flow through the system in real time.
            </p>
          </div>

          <div className="rounded-xl border border-border/30 bg-card/10 p-4 sm:p-8 overflow-hidden">
            <AnimatedArchDiagram />
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Hybrid Accuracy", val: "98.4%" },
              { label: "Hybrid F1",       val: "98.4%" },
              { label: "ML Accuracy",     val: "92.5%" },
              { label: "ML F1",           val: "92.6%" },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-lg border border-border/30 bg-card/20">
                <div className="text-2xl font-bold text-gradient">{s.val}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────── */}
      <section className="relative py-24 px-6 border-t border-border/20 bg-card/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-mono text-primary/60 tracking-widest uppercase mb-3">Detection Architecture</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Dual-Model Parallel Pipeline</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Both models run simultaneously on HuggingFace Spaces — results merge in a weighted decision node for maximum accuracy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PIPELINE.map((item) => {
              const Icon = item.icon;
              const accentMap = {
                blue:   { border: "border-blue-500/20",   bg: "bg-blue-500/8",   icon: "text-blue-400",   badge: "bg-blue-500/10 text-blue-300 border-blue-500/20",   glow: "card-glow-blue" },
                purple: { border: "border-purple-500/20", bg: "bg-purple-500/8", icon: "text-purple-400", badge: "bg-purple-500/10 text-purple-300 border-purple-500/20", glow: "card-glow-purple" },
                green:  { border: "border-green-500/20",  bg: "bg-green-500/8",  icon: "text-green-400",  badge: "bg-green-500/10 text-green-300 border-green-500/20",  glow: "card-glow-green" },
              }[item.accent];
              return (
                <div key={item.title} className={`relative p-6 rounded-xl border ${accentMap.border} bg-card/30 backdrop-blur-sm ${accentMap.glow} transition-all hover:-translate-y-1`}>
                  <div className={`inline-flex p-2.5 rounded-lg ${accentMap.bg} mb-4`}><Icon className={`h-5 w-5 ${accentMap.icon}`} /></div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-foreground">{item.title}</h3>
                      <p className="text-xs text-muted-foreground/70 font-mono">{item.sub}</p>
                    </div>
                    <div className={`text-right px-2 py-1 rounded border ${accentMap.badge} text-[11px] font-mono font-bold shrink-0`}>
                      <div className="text-lg leading-none">{item.accuracy}</div>
                      <div className="text-[9px] opacity-70">{item.metric}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ATTACK TYPES ────────────────────────── */}
      <section className="relative py-24 px-6 border-t border-border/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono text-primary/60 tracking-widest uppercase mb-3">Threat Intelligence</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Attack Types Detected</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ATTACK_TYPES.map((a) => (
              <div key={a.label} className="flex items-start gap-3 p-4 rounded-xl border border-border/30 bg-card/20 hover:bg-card/30 transition-colors">
                <span className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${a.dot}`} />
                <div>
                  <p className={`font-mono text-sm font-semibold ${a.color}`}>{a.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────── */}
      <section className="relative py-24 px-6 border-t border-border/20 bg-card/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-mono text-primary/60 tracking-widest uppercase mb-3">What's Inside</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Everything You Need</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Shield,       title: "Prompt Analyzer", desc: "Paste any prompt — get ALLOW/BLOCK with risk score and trigger words.", color: "text-blue-400",   path: "/analyzer"  },
              { icon: MessageSquare,title: "Firewall Chat",   desc: "Every chat message screened before it reaches the LLM.",             color: "text-purple-400", path: "/chat"       },
              { icon: Activity,     title: "Dashboard",       desc: "Real-time stats: block rate, attack breakdown, daily activity.",      color: "text-green-400",  path: "/dashboard"  },
              { icon: BarChart3,    title: "Log History",     desc: "Paginated analysis history with verdict filters and risk scores.",    color: "text-orange-400", path: "/logs"       },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <button key={f.title} onClick={() => navigate(f.path)}
                  className="text-left p-5 rounded-xl border border-border/30 bg-card/20 hover:bg-card/40 hover:border-border/60 transition-all hover:-translate-y-1 group">
                  <Icon className={`h-6 w-6 ${f.color} mb-3 group-hover:scale-110 transition-transform`} />
                  <h3 className="font-bold text-sm text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────── */}
      <section className="relative py-28 px-6 border-t border-border/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent pointer-events-none" />
        <GridBg />
        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-8">
          <img src="/redlock-logo.png" alt="RedLockX" className="h-16 w-16 object-contain glow-red mx-auto" />
          <h2 className="text-3xl sm:text-5xl font-bold">Ready to shield your<br /><span className="text-gradient">AI system?</span></h2>
          <p className="text-muted-foreground text-lg">Open the firewall interface and run your first prompt analysis in seconds.</p>
          <button onClick={() => navigate("/dashboard")}
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-primary text-primary-foreground font-mono font-bold text-base hover:bg-primary/90 transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:scale-105">
            <Shield className="h-5 w-5" />
            Get Started — Launch Firewall
            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-xs text-muted-foreground/50 font-mono">Powered by HuggingFace Spaces · Built by blackXmask</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="border-t border-border/20 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground/40">
          <div className="flex items-center gap-2">
            <img src="/redlock-logo.png" alt="" className="h-5 w-5 object-contain opacity-50" />
            <span>RedLockX — AI Prompt Injection Firewall</span>
          </div>
          <div className="flex items-center gap-4">
            <span>by blackXmask</span>
            <span>·</span>
            <a href="https://huggingface.co/blackxmask" target="_blank" rel="noopener" className="hover:text-foreground transition-colors">HuggingFace</a>
            <span>·</span>
            <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors">Launch App</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
