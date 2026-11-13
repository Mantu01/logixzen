"use client";

import { useState } from "react";
import { Check, Info, Moon, Sun } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { AiConfigSection } from "@/components/settings/AiConfigSection";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useThemeStore } from "@/stores/useThemeStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useDesktopBridge } from "@/hooks/use-desktop-bridge";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
  { value: "system", label: "System", icon: <Info className="size-3.5" /> },
];

export default function SettingsPage(): React.ReactElement {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const editorFontSize = useProgressStore((state) => state.settings.editorFontSize);
  const setFontSize = useProgressStore((state) => state.setFontSize);
  const connected = useDesktopBridge();
  const [saved, setSaved] = useState(false);

  const fontPreview = (
    <div className="border border-border bg-editor p-3">
      <pre className="font-mono" style={{ fontSize: editorFontSize }}>
        {"SELECT u.name, COUNT(o.id) AS orders\nFROM users u\nJOIN orders o ON o.user_id = u.id\nGROUP BY u.id\nORDER BY orders DESC;"}
      </pre>
    </div>
  );

  return (
    <PageShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-6 px-5 py-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">Appearance</span>
          </div>
          <div className="border border-border bg-surface p-4">
            <Label className="mb-2 block text-[11.5px] text-muted">Theme</Label>
            <div className="flex border border-border">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex h-8 flex-1 items-center justify-center gap-1.5 text-[12px] transition-colors",
                    theme === option.value
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {option.icon} {option.label}
                  {theme === option.value ? <Check className="size-3 text-primary" /> : null}
                </button>
              ))}
            </div>

            <Label className="mb-2 mt-4 block text-[11.5px] text-muted">
              Editor font size — <span className="numeric">{editorFontSize}px</span>
            </Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[editorFontSize]}
                min={11}
                max={20}
                step={1}
                onValueChange={(values) => {
                  const size = values[0] ?? editorFontSize;
                  setFontSize(size);
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1000);
                }}
                className="w-56"
              />
              {saved ? <span className="text-[10.5px] text-success">saved</span> : null}
            </div>
            <div className="mt-3">{fontPreview}</div>
          </div>
        </section>

        <section>
          <span className="section-label mb-2 block">AI assistant</span>
          <AiConfigSection />
        </section>

        <section>
          <div className="mb-2">
            <span className="section-label">About</span>
          </div>
          <div className="divide-y divide-border border border-border bg-surface text-[12.5px]">
            <Row label="App" value="LogixZen Desktop" />
            <Row label="Runtime" value={connected ? "Electron (native engine)" : "Browser preview"} />
            <Row label="Engine" value="SQLite via node:sqlite" />
            <Row label="Version" value="0.1.0" />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted-dim">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
