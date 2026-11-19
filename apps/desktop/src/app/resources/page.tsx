"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Download, Loader2 } from "lucide-react";
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

export default function ResourcesPage(): React.ReactElement {
  return (
    <PageShell
      title="Our Resources"
      subtitle="Curated tracks — database, questions and notes are validated and installed together"
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-muted">
          Every resource is downloaded from the official LogixZen repository,
          executed against the SQL engine and cross-checked with the installed
          content before a single row is stored.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {OFFICIAL_RESOURCES.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-dim">
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
  const categories = resource.noteCategories?.length ?? null;
  const message =
    result?.ok === true
      ? `${result.counts.questions} questions · ${result.counts.notes} notes · ${result.tables} tables installed`
      : null;

  return (
    <div className="flex flex-col border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-alt px-3 py-2">
        <span className="section-label">{resource.level}</span>
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
            {categories === null
              ? "Every note category"
              : `${categories} note categories`}
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
          <Link
            href="/learn"
            className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted transition-colors hover:text-foreground"
          >
            Open practice <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
