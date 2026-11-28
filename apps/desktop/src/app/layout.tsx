import type { Metadata } from "next";
import { ThemeApplier } from "@/components/theme-applier";
import { TitleBar } from "@/components/title-bar";
import { StatusBar } from "@/components/app-shell/status-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MenuNavigation } from "@/components/menu-navigation";
import { RoutePersistence } from "@/components/route-persistence";
import { SetupGate } from "@/components/setup/setup-gate";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogixZen",
  description: "Practice environments that run entirely on your machine.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("dark h-full font-sans antialiased")}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <ThemeApplier />
        <MenuNavigation />
        <RoutePersistence />
        <SetupGate />
        <TooltipProvider delayDuration={200}>
          <TitleBar />
          <div className="flex min-h-0 flex-1">{children}</div>
          <StatusBar />
        </TooltipProvider>
      </body>
    </html>
  );
}
