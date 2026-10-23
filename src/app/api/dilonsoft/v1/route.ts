// DilonSoft Custom API v1: who this shop is and what it can do. DilonSoft's "Test connection" calls it.
import { getSettings } from "@/lib/settings";
import { apiRoute, siteUrl } from "@/lib/dilonsoft/http";
import { PROTOCOL, PROTOCOL_VERSION, type SiteInfo } from "@/lib/dilonsoft/protocol";

export const GET = apiRoute(async (request, _params, principal): Promise<SiteInfo> => {
  const settings = await getSettings();
  const url = siteUrl(request);
  return {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    site: { name: settings.general.siteName, url, admin_url: `${url}/admin`, currency: "EUR", locales: ["bg", "en"] },
    capabilities: ["orders", "products", "stock", "shipments", "cancellations", "admin", "mcp"],
    acting_as: principal.user.email,
  };
});
