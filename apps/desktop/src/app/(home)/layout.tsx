export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-w-0 flex-1 overflow-hidden">{children}</main>;
}
