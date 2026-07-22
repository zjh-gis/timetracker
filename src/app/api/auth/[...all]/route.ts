import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { assertProductionEnvironment } from "@/lib/server-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  assertProductionEnvironment();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  assertProductionEnvironment();
  return handlers.POST(request);
}
