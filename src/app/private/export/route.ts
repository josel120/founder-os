import { requireAuth } from "@/lib/require-auth";
import { reportError } from "@/lib/report-error";
import { buildOwnerExport } from "@/modules/export/services/export";

// ADR-022: the owner downloads their own records as one JSON file. Never cached, never indexed.
export const dynamic = "force-dynamic";

const privateHeaders = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

export async function GET() {
  const owner = await requireAuth();
  if (!owner) return Response.json({ error: "Sign in again to export." }, { status: 401, headers: privateHeaders });
  try {
    const exported = await buildOwnerExport(owner.id);
    if (!exported) return Response.json({ error: "Export is unavailable." }, { status: 503, headers: privateHeaders });
    const day = exported.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(exported, null, 2), {
      headers: { ...privateHeaders, "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="founder-os-export-${day}.json"` },
    });
  } catch (error) {
    reportError("export", error);
    return Response.json({ error: "Export failed. Try again." }, { status: 500, headers: privateHeaders });
  }
}
