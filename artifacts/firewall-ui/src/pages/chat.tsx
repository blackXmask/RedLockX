import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert,
  Shield,
  Send,
  Bot,
  User,
  Settings2,
  Lock,
  AlertTriangle,
  Cpu,
  ChevronDown,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
      .then((data) => {
        setLlmSettings(data);
        setSettingsLoaded(true);
      })
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

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const historyForApi = messages
    .filter((m) => !m.blocked)
    .map((m) => ({ role: m.role, content: m.content }));

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          history: historyForApi,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Request failed");
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
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
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? updatedUser : m)));
      } else {
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: "assistant",
          content: data.reply ?? "",
        };
        setMessages((prev) => [
          ...prev.map((m) => (m.id === userMsg.id ? updatedUser : m)),
          aiMsg,
        ]);
      }
    } catch {
      setError("Network error — check your connection.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Cpu className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  if (!llmSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-blue">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">No LLM Configured</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Add an API key in Settings to enable the firewall-gated AI chat.
          </p>
        </div>
        <Link href="/settings">
          <Button className="glow-blue-sm">
            <Settings2 className="h-4 w-4 mr-2" />
            Go to Settings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] pb-16 md:pb-0">
      {/* Header */}
      <div className="flex-none flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Firewall Chat
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5 font-mono">
            Every message is scanned before reaching the LLM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-active text-[10px] font-mono px-2 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {llmSettings.provider.toUpperCase()} · {llmSettings.model}
          </span>
        </div>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-3 pr-1 relative"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-blue">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start chatting. Each prompt is scanned by the firewall before being forwarded to{" "}
              <span className="text-primary font-medium">{llmSettings.model}</span>.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 pl-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Cpu className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div className="chat-bubble-ai rounded-xl px-4 py-3 text-sm text-muted-foreground animate-pulse">
              Scanning prompt… running firewall…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom btn */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-28 right-6 z-30 w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shadow-lg glow-blue-sm md:bottom-24"
        >
          <ChevronDown className="h-4 w-4 text-primary" />
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex-none flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mt-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {/* Input area */}
      <div className="flex-none mt-3">
        <div className="flex items-end gap-2 p-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
          <div className="flex-1 min-w-0">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={isLoading}
              className="resize-none min-h-[40px] max-h-[160px] bg-transparent border-0 focus-visible:ring-0 p-0 text-sm font-sans placeholder:text-muted-foreground/50"
              style={{ overflow: "hidden" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="shrink-0 h-9 w-9 p-0 rounded-lg glow-blue-sm"
          >
            {isLoading ? (
              <Cpu className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5 font-mono flex items-center justify-center gap-1">
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
  const isAllow = msg.verdict === "ALLOW";

  return (
    <div className={`flex gap-2 sm:gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-start`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? isBlocked
              ? "bg-destructive/20 border border-destructive/30"
              : "bg-primary/15 border border-primary/25"
            : "bg-white/5 border border-white/10"
        }`}
      >
        {isUser ? (
          isBlocked ? (
            <Lock className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <User className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      <div className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Verdict badge for user messages */}
        {isUser && msg.verdict && (
          <div className={`flex items-center gap-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isBlocked ? "badge-block" : "badge-allow"
              }`}
            >
              {isBlocked ? (
                <><ShieldAlert className="h-2.5 w-2.5" /> BLOCKED</>
              ) : (
                <><Shield className="h-2.5 w-2.5" /> SAFE</>
              )}
            </span>
            {msg.riskScore !== undefined && (
              <span className={`text-[10px] font-mono ${msg.riskScore > 50 ? "text-destructive" : "text-muted-foreground"}`}>
                {msg.riskScore.toFixed(0)}% risk
              </span>
            )}
          </div>
        )}

        {/* Message content */}
        {isBlocked ? (
          <div className="chat-bubble-blocked rounded-xl px-3 sm:px-4 py-3 space-y-2 w-full">
            <div className="flex items-center gap-2 text-destructive text-xs font-bold">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              PROMPT BLOCKED BY FIREWALL
            </div>
            <p className="text-muted-foreground text-xs font-mono break-words">{msg.content}</p>
            {msg.analysis && (
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
              >
                {showDetail ? "Hide details ▲" : "View details ▼"}
              </button>
            )}
            {showDetail && msg.analysis && (
              <div className="text-[11px] text-muted-foreground font-mono bg-black/20 rounded-lg p-2 space-y-1 border border-border/30">
                <div>Hybrid risk: {(msg.analysis.hybridProbability * 100).toFixed(1)}%</div>
                <div>ML: {msg.analysis.mlStatus} ({(msg.analysis.mlConfidence * 100).toFixed(1)}%)</div>
                {msg.attackType && <div>Attack: {msg.attackType.replace(/_/g, " ")}</div>}
                <div className="pt-1 leading-relaxed">{msg.analysis.explanation}</div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`rounded-xl px-3 sm:px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap ${
              isUser ? "chat-bubble-user" : "chat-bubble-ai"
            }`}
          >
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}
