"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Database, Info, Moon, Sun } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { AiConfigSection } from "@/components/settings/AiConfigSection";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useThemeStore } from "@/stores/useThemeStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useDesktopBridge } from "@/hooks/use-desktop-bridge";
import { useSqlStore } from "@/sql/useSqlStore";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS: Array<{
  value: ThemeChoice;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
  { value: "system", label: "System", icon: <Info className="size-3.5" /> },
];

export default function SettingsPage(): React.ReactElement {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const editorFontSize = useProgressStore(
    (state) => state.settings.editorFontSize,
  );
  const setEditorFontSize = useProgressStore(
    (state) => state.setEditorFontSize,
  );
  const resultFontSize = useProgressStore(
    (state) => state.settings.resultFontSize,
  );
  const setResultFontSize = useProgressStore(
    (state) => state.setResultFontSize,
  );
  const connected = useDesktopBridge();
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const activeDialect = useSqlStore((state) => state.activeDialect);

  const [runtimeVersions, setRuntimeVersions] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.logixzen?.setup?.snapshot) {
      void window.logixzen.setup.snapshot().then((res) => {
        if (res.ok) {
          setRuntimeVersions(
            `Electron ${res.data.runtime.electron} · Node ${res.data.runtime.node} (${res.data.arch})`,
          );
        }
      });
    }
  }, []);

  const fontPreview = (
    <div className="border border-border bg-editor p-3">
      <pre className="font-mono" style={{ fontSize: editorFontSize }}>
        {
          "SELECT u.name, COUNT(o.id) AS orders\nFROM users u\nJOIN orders o ON o.user_id = u.id\nGROUP BY u.id\nORDER BY orders DESC;"
        }
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
                  {theme === option.value ? (
                    <Check className="size-3 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>

            <FontSlider
              label="Editor font size"
              value={editorFontSize}
              onChange={setEditorFontSize}
            />
            <FontSlider
              label="Result font size"
              value={resultFontSize}
              onChange={setResultFontSize}
            />
            <div className="mt-3">{fontPreview}</div>
          </div>
        </section>

        <section>
          <span className="section-label mb-2 block">AI assistant</span>
          <AiConfigSection />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">Database Management</span>
          </div>
          <div className="border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database className="size-4 text-primary shrink-0" />
                <span className="font-medium text-[12.5px] text-foreground">
                  Databases & Engines
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Manage installed engines, active connection, storage footprints,
                and practice databases.
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-border h-8 text-[11.5px]"
            >
              <Link href="/databases">Open Database Manager</Link>
            </Button>
          </div>
        </section>

        <section>
          <div className="mb-2">
            <span className="section-label">About</span>
          </div>
          <div className="divide-y divide-border border border-border bg-surface text-[12.5px]">
            <Row label="App" value="LogixZen Desktop" />
            <Row
              label="Runtime"
              value={
                connected
                  ? (runtimeVersions ?? "Electron (native engine)")
                  : "Browser preview"
              }
            />
            <Row
              label="Engine"
              value={`${activeEngineName} (${activeDialect.toUpperCase()})`}
            />
            <Row label="Version" value="0.1.0" />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function FontSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (size: number) => void;
}): React.ReactElement {
  return (
    <>
      <Label className="mb-2 mt-4 block text-[11.5px] text-muted">
        {label} — <span className="numeric">{value}px</span>
      </Label>
      <Slider
        value={[value]}
        min={10}
        max={22}
        step={1}
        onValueChange={(values) => {
          const size = values[0];
          if (size !== undefined) onChange(size);
        }}
        className="w-56"
      />
    </>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted-dim">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
