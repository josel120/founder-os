import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { requireAuth } from "@/lib/require-auth";
import { safePrivatePath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safePrivatePath((await searchParams).next);
  if (await requireAuth()) redirect(next);
  return <AuthForm next={next} />;
}
