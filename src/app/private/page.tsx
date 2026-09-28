import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { AttentionHome } from "@/modules/cockpit/components/attention-home";
import { getAttention } from "@/modules/cockpit/queries/attention.queries";

// Generic title: nothing private in metadata.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Home") };
}

export default async function PrivateHomePage() {
  const now = new Date();
  const [attention, t] = await Promise.all([getAttention(now), getT()]);
  if (!attention) redirect("/login");
  return <AttentionHome attention={attention} now={now} t={t} />;
}
