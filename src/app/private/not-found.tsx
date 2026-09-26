import Link from "next/link";

export default function PrivateNotFound() {
  return <section className="workspace-panel px-6 py-14 text-center"><h1 className="font-semibold">Nothing here.</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">This record does not exist or is not part of your workspace.</p><Link href="/private/ideas" className="mt-5 inline-block text-sm font-semibold text-indigo-700">Back to your ideas</Link></section>;
}
