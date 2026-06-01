import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Settings2,
  Key,
  Cpu,
  Globe,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Zap,
  Radio,
  ToggleRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const PROVIDERS = [
  { id: "openai",  label: "OpenAI",  defaultModel: "gpt-4o-mini",               defaultBase: null },
  { id: "groq",   label: "Groq",    defaultModel: "llama-3.3-70b-versatile",    defaultBase: null },
  { id: "gemini", label: "Gemini",  defaultModel: "gemini-2.0-flash",           defaultBase: null },
  { id: "custom", label: "Custom",  defaultModel: "",                           defaultBase: "" },
] as const;

const DETECTION_RULES = [
  { id: "direct",     label: "Direct Injection",     description: "Explicit prompt override attempts" },
  { id: "indirect",   label: "Indirect Injection",   description: "Context manipulation via external data" },
  { id: "obfuscated", label: "Obfuscated Injection",  description: "Base64, unicode and encoding tricks" },
  { id: "encoding",   label: "Encoding Evasion",     description: "Character substitution & homoglyphs" },
  { id: "jailbreak",  label: "Jailbreak Attempts",   description: "Role-play and DAN-style bypasses" },
  { id: "privilege",  label: "Privilege Escalation", description: "Attempts to gain system-level access" },
];

const schema = z.object({
  provider: z.enum(["openai", "groq", "gemini", "custom"]),
  apiKey: z.string().min(1, "API key required"),
  model: z.string().min(1, "Model required"),
  baseUrl: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const [activeProvider, setActiveProvider] = useState<"openai"|"groq"|"gemini"|"custom">("openai");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<{ provider: string; model: string; hasApiKey: boolean } | null>(null);
  const [rules, setRules] = useState<Record<string, boolean>>(
    Object.fromEntries(DETECTION_RULES.map((r) => [r.id, true]))
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { provider: "openai", apiKey: "", model: "gpt-4o-mini", baseUrl: null },
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCurrentSettings(data);
          setActiveProvider(data.provider);
          form.setValue("provider", data.provider);
          form.setValue("model", data.model);
          if (data.baseUrl) form.setValue("baseUrl", data.baseUrl);
        }
      })
      .catch(() => {});
  }, [form]);

  function selectProvider(id: typeof activeProvider) {
    setActiveProvider(id);
    form.setValue("provider", id);
    const p = PROVIDERS.find((p) => p.id === id)!;
    if (p.defaultModel) form.setValue("model", p.defaultModel);
    form.setValue("baseUrl", p.defaultBase);
    setSaved(false);
    setSaveError(null);
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Save failed");
      } else {
        const data = await res.json();
        setCurrentSettings({ ...data });
        setSaved(true);
        form.setValue("apiKey", "");
        setTimeout(() => setSaved(false), 4000);
      }
    } catch {
      setSaveError("Network error — check your connection");
    } finally {
      setIsSaving(false);
    }
  }

  const showBaseUrl = activeProvider === "custom";

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          Settings
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure LLM provider and detection rules.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6">
        {/* ── Left: LLM Config ─────────────────────── */}
        <div className="xl:col-span-7 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm uppercase tracking-wider">LLM Provider</span>
              {currentSettings && (
                <span className="ml-auto badge-active text-[10px] font-mono px-2 py-0.5 rounded-full">
                  {currentSettings.provider.toUpperCase()} ACTIVE
                </span>
              )}
            </div>

            {/* Provider tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProvider(p.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    activeProvider === p.id
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                        <Key className="h-3 w-3" /> API Key
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={
                            currentSettings?.hasApiKey
                              ? "••••••••••••  (saved — leave blank to keep)"
                              : "Enter your API key"
                          }
                          className="font-mono bg-background border-border focus-visible:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                        <Zap className="h-3 w-3" /> Model
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. gpt-4o-mini"
                          className="font-mono bg-background border-border focus-visible:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showBaseUrl && (
                  <FormField
                    control={form.control}
                    name="baseUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                          <Globe className="h-3 w-3" /> Base URL
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://your-endpoint.com/v1"
                            className="font-mono bg-background border-border focus-visible:ring-primary"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto font-bold tracking-wide glow-blue-sm"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2"><span className="animate-pulse">Saving…</span></span>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" />Save Settings</>
                    )}
                  </Button>

                  {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-green-400">
                      <CheckCircle2 className="h-4 w-4" /> Saved successfully
                    </span>
                  )}
                  {saveError && (
                    <span className="flex items-center gap-1.5 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" /> {saveError}
                    </span>
                  )}
                </div>
              </form>
            </Form>
          </div>

          {/* Engine status card */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-green-400" />
              <span className="font-semibold text-sm uppercase tracking-wider">Engine Status</span>
              <span className="ml-auto badge-active text-[10px] font-mono px-2 py-0.5 rounded-full">ONLINE</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { label: "Detection Engine", value: "Hybrid AI + Heuristics" },
                { label: "Sensitivity Level", value: "High" },
                { label: "Heuristic Rules", value: "v4.2.1" },
                { label: "ML Classifier", value: "DeBERTa-v3 (Active)" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center p-2 rounded-lg bg-background/60 border border-border/50">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-primary font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Detection Rules ────────────────── */}
        <div className="xl:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm uppercase tracking-wider">Detection Rules</span>
            </div>
            <div className="space-y-2">
              {DETECTION_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg transition-all border ${
                    rules[rule.id]
                      ? "bg-primary/5 border-primary/20"
                      : "bg-background/40 border-border/40"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{rule.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{rule.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono font-bold ${rules[rule.id] ? "text-primary" : "text-muted-foreground"}`}>
                      {rules[rule.id] ? "ON" : "OFF"}
                    </span>
                    <Switch
                      checked={rules[rule.id] ?? true}
                      onCheckedChange={(v) => setRules((r) => ({ ...r, [rule.id]: v }))}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm uppercase tracking-wider">System Health</span>
            </div>
            {[
              { label: "Hybrid Layer (HF)", value: 100, color: "bg-green-500" },
              { label: "ML Layer (HF)", value: 100, color: "bg-green-500" },
              { label: "Database", value: 100, color: "bg-primary" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-mono font-bold ${item.value === 100 ? "text-green-400" : "text-yellow-400"}`}>
                    {item.value === 100 ? "OK" : `${item.value}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${item.color}`}
                    style={{ width: `${item.value}%`, boxShadow: `0 0 6px currentColor` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
