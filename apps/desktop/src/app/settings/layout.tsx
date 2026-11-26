export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-w-0 flex-1 overflow-hidden">{children}</main>;
}
