import React from "react";
import { Link, useLocation } from "wouter";
import { ShieldAlert, Terminal, Activity, History } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Analyzer", icon: Terminal },
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/logs", label: "Logs", icon: History },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-r border-border bg-card flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-md">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground">PROMPT<span className="text-primary">FW</span></h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">v2.1.0-alpha</p>
          </div>
        </div>
        <nav className="flex-1 px-4 pb-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
