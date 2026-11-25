"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Download, Loader2 } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { InstallReport } from "@/components/packs/install-report";
import { usePackStore } from "@/stores/usePackStore";
import {
  OFFICIAL_RESOURCES,
  type OfficialResource,
} from "@/lib/packs/official";
import {
  installResource,
  type ResourceInstallResult,
} from "@/lib/packs/install";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<OfficialResource["level"], string> = {
  Beginner: "border-success/40 text-success",
  Advanced: "border-warning/40 text-warning",
  Complete: "border-primary/40 text-primary",
};

export default function ResourcesPage(): React.ReactElement {
  const installed = usePackStore((state) => state.installedResources.length);

  return (
    <PageShell
      title="Our Resources"
      subtitle={`${installed}/${OFFICIAL_RESOURCES.length} installed · database, questions and notes are validated as one unit`}
      actions={
        <Link
          href="/import"
          className="flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Data Hub
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
        <p className="mb-5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
          Every track ships its seeded database together with its questions and
          study notes. The script runs against the SQL engine, the schema is
          read back, and each question is checked against it before a single row
          is stored.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {OFFICIAL_RESOURCES.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
        <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted-dim">
          Resources install into local storage only. Nothing leaves this machine
          and progress is tracked by the app, never by the files.
        </p>
      </div>
    </PageShell>
  );
}

function ResourceCard({
  resource,
}: {
  resource: OfficialResource;
}): React.ReactElement {
  const installed = usePackStore((state) =>
    state.installedResources.includes(resource.id),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResourceInstallResult | null>(null);

  const run = async (): Promise<void> => {
    setBusy(true);
    setResult(await installResource(resource));
    setBusy(false);
  };

  const topics = resource.topics?.length ?? null;
  const noteCategories = resource.noteCategories?.length ?? null;
  const message =
    result?.ok === true
      ? `${result.counts.questions} questions · ${result.counts.notes} notes · ${result.tables} tables installed`
      : null;

  return (
    <div className="flex flex-col border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-alt px-3 py-2">
        <span
          className={cn(
            "border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider",
            LEVEL_TONE[resource.level],
          )}
        >
          {resource.level}
        </span>
        {installed ? (
          <span className="flex items-center gap-1 text-[10.5px] text-success">
            <Check className="size-3" /> Installed
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-3.5">
        <h2 className="text-[14px] font-semibold">{resource.title}</h2>
        <p className="text-[11.5px] leading-relaxed text-muted">
          {resource.summary}
        </p>
        <div className="numeric mt-1 flex flex-col gap-0.5 text-[10.5px] text-muted-dim">
          <span>1 database</span>
          <span>{topics === null ? "Every topic" : `${topics} topics`}</span>
          <span>
            {noteCategories === null
              ? "Every note category"
              : `${noteCategories} note categories`}
          </span>
        </div>
      </div>
      <div className="border-t border-border px-3 py-2.5">
        <Button
          size="sm"
          variant={installed ? "outline" : "default"}
          className="w-full gap-1.5"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          {busy
            ? "Validating…"
            : installed
              ? "Reinstall"
              : "Download & install"}
        </Button>
        <InstallReport status={result} message={message} />
        {installed && !busy ? (
          <div className="mt-2 flex items-center justify-center gap-3 text-[11px]">
            <Link href="/learn" className="text-muted hover:text-foreground">
              Practice
            </Link>
            <span className="text-border">·</span>
            <Link href="/notes" className="text-muted hover:text-foreground">
              Notes
            </Link>
            <span className="text-border">·</span>
            <Link href="/schema" className="text-muted hover:text-foreground">
              ER diagram
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
