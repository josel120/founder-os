import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AttentionHome } from "@/modules/cockpit/components/attention-home";
import { getAttention } from "@/modules/cockpit/queries/attention.queries";

// Generic title: nothing private in metadata.
export const metadata: Metadata = { title: "Home" };

export default async function PrivateHomePage() {
  const now = new Date();
  const attention = await getAttention(now);
  if (!attention) redirect("/login");
  return <AttentionHome attention={attention} now={now} />;
}
