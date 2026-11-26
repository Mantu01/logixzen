"use client";

import Link from "next/link";
import { useDesktopBridge } from "@/hooks/use-desktop-bridge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M1.5 6h9"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="8"
        height="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 2.5l7 7m0-7l-7 7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TitleBar() {
  const connected = useDesktopBridge();

  const toggleMaximize = (): void => {
    if (connected) window.logixzen?.window.maximize();
  };

  return (
    <header
      className="app-drag flex h-9 shrink-0 select-none items-center justify-between border-b border-border bg-titlebar pr-0"
      onDoubleClick={toggleMaximize}
    >
      <div className="flex min-w-0 items-center gap-2 pl-3">
        <Link
          href="/"
          className="app-no-drag flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="LogixZen home"
        >
          <span className="flex size-5 items-center justify-center bg-primary text-primary-foreground">
            <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 4.5l3 3.5-3 3.5M8.5 11.5H13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-[12.5px] font-semibold tracking-tight text-foreground">
            LogixZen
          </span>
        </Link>
      </div>

      <div className="app-no-drag flex h-full items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mr-2 hidden items-center gap-1.5 text-[10.5px] text-muted-dim md:flex">
              <span
                className={`size-1.5 ${connected ? "bg-success" : "bg-warning"}`}
              />
              {connected ? "Desktop" : "Browser preview"}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {connected
              ? "Connected to Electron desktop runtime"
              : "Browser preview mode — native database installers require the desktop app"}
          </TooltipContent>
        </Tooltip>
        {connected ? (
          <>
            <TitleButton
              label="Minimize window"
              onClick={() => window.logixzen?.window.minimize()}
            >
              <MinimizeIcon />
            </TitleButton>
            <TitleButton
              label="Toggle maximize"
              onClick={() => window.logixzen?.window.maximize()}
            >
              <MaximizeIcon />
            </TitleButton>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Close window"
                  onClick={() => window.logixzen?.window.close()}
                  className="flex h-full w-11 items-center justify-center text-muted transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <CloseIcon />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close window</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <div className="h-full w-2" />
        )}
      </div>
    </header>
  );
}

function TitleButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="flex h-full w-11 items-center justify-center text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
