import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const GET = auth ? toNextJsHandler(auth).GET : async () => new Response("Authentication is not configured", { status: 503 });
export const POST = auth ? toNextJsHandler(auth).POST : async () => new Response("Authentication is not configured", { status: 503 });
