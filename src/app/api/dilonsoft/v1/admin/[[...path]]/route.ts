// DilonSoft Custom API v1 - the admin panel. The endpoints are listed in src/lib/dilonsoft/admin/dispatch.ts.
import { apiRoute } from "@/lib/dilonsoft/http";
import { handleAdmin } from "@/lib/dilonsoft/admin/dispatch";

export const dynamic = "force-dynamic";

const route = apiRoute<{ path?: string[] }>((request, { path }) => handleAdmin(request, path ?? []));
export const GET = route;
export const POST = route;
export const PATCH = route;
export const DELETE = route;
