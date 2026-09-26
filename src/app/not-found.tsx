import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"><p className="text-sm font-medium uppercase tracking-widest text-slate-500">Founder OS</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found.</h1><p className="mt-3 text-slate-600">The page you asked for does not exist.</p><Link href="/" className="mt-6 w-fit rounded-md bg-slate-900 px-4 py-2 text-sm text-white">Go home</Link></main>;
}
