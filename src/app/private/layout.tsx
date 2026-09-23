import Link from "next/link";
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-10"><header className="mb-10 flex items-center justify-between"><Link className="font-semibold" href="/private/ideas">Founder OS</Link><span className="text-sm text-slate-500">Private workspace</span></header>{children}</main>;
}
