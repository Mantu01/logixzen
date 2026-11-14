import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { ThemeApplier } from "@/components/theme-applier";
import { TitleBar } from "@/components/title-bar";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { StatusBar } from "@/components/app-shell/status-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MenuNavigation } from "@/components/menu-navigation";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "LogixZen",
  description: "Practice environments that run entirely on your machine.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("dark h-full font-sans antialiased", geist.variable, mono.variable)}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <ThemeApplier />
        <MenuNavigation />
        <TooltipProvider delayDuration={200}>
          <TitleBar />
          <div className="flex min-h-0 flex-1">
            <AppSidebar />
            <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
          <StatusBar />
        </TooltipProvider>
      </body>
    </html>
  );
}
