import { AppSidebar } from "@/components/app-shell/app-sidebar";

export default function SqlLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </>
  );
}
