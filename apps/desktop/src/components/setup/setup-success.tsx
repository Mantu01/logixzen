"use client";

import Link from "next/link";
import { CheckCircle2, Terminal, Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SetupSuccessProps {
  installedOptions: string[];
  onResetSetup: () => void;
}

export function SetupSuccess({
  installedOptions,
  onResetSetup,
}: SetupSuccessProps): React.ReactElement {
  return (
    <div className="space-y-5 max-w-xl mx-auto text-center py-6 text-[11.5px]">
      <div className="border border-border bg-surface p-6 space-y-4">
        <div className="mx-auto flex size-10 items-center justify-center border border-success/30 bg-success/10 text-success">
          <CheckCircle2 className="size-5" />
        </div>

        <div>
          <h2 className="text-[14px] font-semibold text-foreground">
            Environment Setup Complete
          </h2>
          <p className="mt-1 text-muted text-[11.5px]">
            Your practice database and engine services are configured, verified,
            and ready for queries.
          </p>
        </div>

        <div className="border-t border-b border-border py-3 text-left space-y-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-dim block">
            Verified Engines & Connections
          </span>
          <div className="space-y-1 font-mono text-[11px]">
            {installedOptions.map((opt) => (
              <div
                key={opt}
                className="flex items-center justify-between py-1 px-2 bg-surface-alt/40 border border-border"
              >
                <span className="text-foreground">{opt}</span>
                <span className="text-success text-[10px] uppercase tracking-wider font-semibold">
                  14 tables · 373 rows ready
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            asChild
            size="sm"
            className="h-8.5 text-[12px] font-medium gap-2"
          >
            <Link href="/playground">
              <Terminal className="size-3.5" />
              <span>Open SQL Editor</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border h-8 text-[11px] gap-2"
          >
            <Link href="/databases">
              <Database className="size-3.5" />
              <span>Manage Databases</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetSetup}
            className="h-7 text-[11px] text-muted-dim hover:text-foreground gap-1.5"
          >
            <Plus className="size-3" />
            <span>Set up another engine</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
