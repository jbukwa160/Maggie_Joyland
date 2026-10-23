// MCP server (Model Context Protocol, Streamable HTTP, stateless): POST /api/mcp with a JSON-RPC
// message and `Authorization: Bearer <API key>` (Admin → API и MCP). The tools are in src/lib/dilonsoft/mcp.ts.
import type { NextRequest } from "next/server";
import { checkKey } from "@/lib/dilonsoft/keys";
import { runAsApi } from "@/lib/dilonsoft/context";
import { overLimit, siteUrl } from "@/lib/dilonsoft/http";
import { handleMessage, SUPPORTED_VERSIONS } from "@/lib/dilonsoft/mcp";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

function rpcError(status: number, code: number, message: string, extra: Record<string, string> = {}) {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: { ...HEADERS, ...extra } });
}

export async function POST(request: NextRequest) {
  // A browser page on another site must not be able to drive the tools with a key it found.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin && origin !== new URL(siteUrl(request) || request.url).origin) {
    return rpcError(403, -32000, "Origin not allowed");
  }
  const check = checkKey(request.headers.get("authorization"));
  if (!check.ok) return rpcError(401, -32001, check.error, { "WWW-Authenticate": 'Bearer realm="mcp"' });
  if (overLimit(check.key.id)) return rpcError(429, -32000, "Твърде много заявки. Опитайте след минута.", { "Retry-After": "60" });
  const version = request.headers.get("mcp-protocol-version");
  if (version && !SUPPORTED_VERSIONS.includes(version)) return rpcError(400, -32000, `Unsupported MCP-Protocol-Version: ${version}`);

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return rpcError(400, -32700, "Parse error");
  }
  const messages = (Array.isArray(body) ? body : [body]) as Parameters<typeof handleMessage>[0][];
  if (!messages.length || messages.some((m) => !m || typeof m !== "object")) return rpcError(400, -32600, "Invalid Request");

  const responses = await runAsApi({ user: check.user, keyId: check.key.id }, async () => {
    const out = [];
    for (const m of messages) {
      const r = await handleMessage(m, request);
      if (r) out.push(r);
    }
    return out;
  });
  // Only notifications (or responses) arrived: nothing to answer.
  if (!responses.length) return new Response(null, { status: 202, headers: HEADERS });
  return Response.json(Array.isArray(body) ? responses : responses[0], { headers: HEADERS });
}

// No server-to-client stream and no sessions in this server.
export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
