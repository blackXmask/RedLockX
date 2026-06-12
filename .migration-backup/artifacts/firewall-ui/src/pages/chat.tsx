import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert, Shield, Send, Bot, User, Settings2,
  Lock, AlertTriangle, Cpu, ChevronDown, Unlock,
} from "lucide-react";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocked?: boolean;
  riskScore?: number;
  verdict?: "BLOCK" | "ALLOW";
  attackType?: string | null;
  analysis?: {
    hybridProbability: number;
    mlStatus: string;
    mlConfidence: number;
    explanation: string;
  };
}

interface LlmSettings {
  provider: string;
  model: string;
  hasApiKey: boolean;
}

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function makeSessionId() { return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => makeSessionId());
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setLlmSettings(d); setSettingsLoaded(true); })
      .catch(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  }

  const historyForApi = messages
    .filter((m) => !m.blocked)
    .map((m) => ({ role: m.role, content: m.content }));

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, history: historyForApi }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Request failed");
        setMessages((p) => p.filter((m) => m.id !== userMsg.id));
        return;
      }

      const data = await res.json();
      const updatedUser: ChatMessage = {
        ...userMsg,
        verdict: data.analysis.verdict,
        riskScore: data.analysis.riskScore,
        blocked: data.blocked,
        attackType: data.analysis.attackType,
        analysis: {
          hybridProbability: data.analysis.hybridProbability,
          mlStatus: data.analysis.mlStatus,
          mlConfidence: data.analysis.mlConfidence,
          explanation: data.analysis.explanation,
        },
      };

      if (data.blocked) {
        setMessages((p) => p.map((m) => m.id === userMsg.id ? updatedUser : m));
      } else {
        const aiMsg: ChatMessage = { id: makeId(), role: "assistant", content: data.reply ?? "" };
        setMessages((p) => [...p.map((m) => m.id === userMsg.id ? updatedUser : m), aiMsg]);
      }
    } catch {
      setError("Network error — check your connection.");
      setMessages((p) => p.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Cpu className="h-8 w-8 animate-pulse text-blue-400" />
      </div>
    );
  }

  if (!llmSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-blue-500/40 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
          <Bot className="h-10 w-10 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-white">No LLM Configured</h3>
          <p className="text-slate-400 text-sm max-w-xs">
            Add an API key in Settings to enable the firewall-gated AI chat.
          </p>
        </div>
        <Link href="/settings">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Settings2 className="h-4 w-4" /> Go to Settings
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] pb-16 md:pb-0">
      {/* Header */}
      <div className="flex-none flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/15">
              <Bot className="h-4 w-4 text-blue-400" />
            </div>
            Firewall Chat
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5 ml-10.5">
            Every message scanned before reaching the LLM
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            {llmSettings.provider} · {llmSettings.model}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-4 pr-1 relative"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-blue-500/30 bg-blue-500/8 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
              <Shield className="h-8 w-8 text-blue-400/70" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-400">Firewall-gated chat active</p>
              <p className="text-sm text-slate-600 mt-1">
                Prompts are scanned by <span className="text-blue-400 font-mono">{llmSettings.model}</span> pipeline before delivery
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full border border-blue-500/30 bg-blue-500/10 flex items-center justify-center shrink-0">
              <Cpu className="h-4 w-4 text-blue-400 animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-700/60 bg-slate-800/40 text-sm text-slate-500 font-mono animate-pulse">
              Scanning prompt… running firewall…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll btn */}
      {showScrollBtn && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-28 right-6 z-30 w-9 h-9 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center shadow-lg hover:border-blue-500/50 transition-all md:bottom-24"
        >
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex-none flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mt-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-slate-500 hover:text-white transition-colors">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="flex-none mt-3">
        <div className="flex items-end gap-3 p-3.5 rounded-xl border-2 border-slate-700/60 bg-[hsl(222,47%,5%)] focus-within:border-blue-500/50 transition-colors">
          <div className="flex-1 min-w-0">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={isLoading}
              className="resize-none min-h-[40px] max-h-[140px] bg-transparent border-0 focus-visible:ring-0 p-0 text-sm text-slate-100 placeholder:text-slate-600 font-sans"
              style={{ overflow: "hidden" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 140) + "px";
              }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
          >
            {isLoading ? <Cpu className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
          </button>
        </div>
        <p className="text-[10px] text-slate-700 text-center mt-1.5 font-mono flex items-center justify-center gap-1">
          <Lock className="h-2.5 w-2.5" />
          All messages scanned by RedLockX firewall before delivery
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [showDetail, setShowDetail] = useState(false);
  const isUser = msg.role === "user";
  const isBlocked = msg.blocked === true;

  if (isBlocked) {
    return (
      <div className="flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full border-2 border-red-500/40 bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="h-4 w-4 text-red-400" />
        </div>
        <div className="flex-1 max-w-[80%]">
          <div className="rounded-2xl rounded-tl-sm border-2 border-red-500/40 bg-red-950/30 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-500/20 bg-red-500/10">
              <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs font-black text-red-400 uppercase tracking-widest">Blocked by Firewall</span>
              {msg.riskScore !== undefined && (
                <span className="ml-auto text-xs font-mono font-bold text-red-400">{msg.riskScore.toFixed(0)}% risk</span>
              )}
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm font-mono text-slate-400 break-words">{msg.content}</p>
              {msg.attackType && (
                <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                  {msg.attackType.replace(/_/g, " ")}
                </span>
              )}
              {msg.analysis && (
                <>
                  <button
                    onClick={() => setShowDetail((v) => !v)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors font-mono"
                  >
                    {showDetail ? "▲ Hide analysis" : "▼ View analysis"}
                  </button>
                  {showDetail && (
                    <div className="text-[11px] font-mono text-slate-500 bg-black/20 rounded-lg p-3 space-y-1 border border-slate-800/60">
                      <div>Hybrid: <span className="text-blue-400">{(msg.analysis.hybridProbability * 100).toFixed(1)}%</span></div>
                      <div>ML: <span className={msg.analysis.mlStatus === "DANGEROUS" ? "text-red-400" : "text-emerald-400"}>{msg.analysis.mlStatus}</span> ({(msg.analysis.mlConfidence * 100).toFixed(1)}%)</div>
                      <div className="pt-1 leading-relaxed text-slate-600">{msg.analysis.explanation}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex gap-3 items-start flex-row-reverse">
        <div className="w-8 h-8 rounded-full border border-blue-500/30 bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex flex-col items-end gap-1 max-w-[78%]">
          {msg.verdict === "ALLOW" && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
              <Unlock className="h-2.5 w-2.5" /> SAFE · {msg.riskScore?.toFixed(0)}% risk
            </span>
          )}
          <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-blue-600/20 border border-blue-500/25 text-sm text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full border border-slate-700/60 bg-slate-800/60 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-slate-400" />
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-700/60 bg-slate-800/40 text-sm text-slate-200 leading-relaxed break-words whitespace-pre-wrap max-w-[78%]">
        {msg.content}
      </div>
    </div>
  );
}
