import React from "react";
import { Link, useLocation } from "wouter";
import { Terminal, Activity, History, Cpu, Radio } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Analyzer", icon: Terminal },
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/logs", label: "Logs", icon: History },
  ];

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col md:flex-row">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="w-full md:w-60 border-b md:border-r border-border/60 bg-[hsl(225,18%,4%)]/90 backdrop-blur-sm flex flex-col">

        {/* Logo block */}
        <div className="px-5 py-6 flex flex-col items-center border-b border-border/60 relative">
          {/* Corner accents */}
          <span className="absolute top-2 left-2 w-3 h-3 border-t border-l border-primary/40" />
          <span className="absolute top-2 right-2 w-3 h-3 border-t border-r border-primary/40" />
          <span className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-primary/30" />
          <span className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-primary/30" />

          <div className="relative">
            <img
              src="/redlock-logo.png"
              alt="RedLock"
              className="h-24 w-24 rounded-xl object-cover ring-1 ring-primary/20"
              style={{ filter: "drop-shadow(0 0 12px rgba(0,229,255,0.2))" }}
            />
            {/* Live pulse ring */}
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          </div>

          <p className="mt-3 text-[9px] text-muted-foreground/50 font-mono tracking-[0.2em] uppercase">
            by blackXmask
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium border border-primary/20 shadow-[0_0_12px_rgba(0,229,255,0.08)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className={`h-4 w-4 transition-all ${isActive ? "text-primary" : "group-hover:text-primary/70"}`} />
                <span className="text-sm font-mono tracking-wide">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-primary shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="px-4 py-4 border-t border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-muted-foreground/70 font-mono tracking-wider uppercase">
              Systems Online
            </span>
          </div>
          <div className="flex items-center gap-2 pl-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[9px] text-muted-foreground/40 font-mono">Hybrid · ML · DB</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────── */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        {/* Top bar */}
        <div className="sticky top-0 z-20 h-10 border-b border-border/40 bg-background/80 backdrop-blur-sm flex items-center px-6 gap-3">
          <Cpu className="h-3 w-3 text-primary/60" />
          <span className="text-[10px] font-mono text-muted-foreground/50 tracking-widest uppercase">
            RedLock Firewall — Prompt Injection Detection System
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400/70">ACTIVE</span>
          </span>
        </div>

        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
