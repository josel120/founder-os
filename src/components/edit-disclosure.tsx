import type { ReactNode } from "react";

/** T-101: keeps a record's edit form closed until the owner asks for it, so detail pages stay short on a phone. */
export function EditDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return <details className="group mt-8 [&>form]:mt-4">
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
      <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>{label}
    </summary>
    {children}
  </details>;
}
