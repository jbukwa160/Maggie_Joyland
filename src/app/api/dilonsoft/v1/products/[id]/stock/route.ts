// DilonSoft sets what can be sold: { quantity }.
import { apiRoute, readJson } from "@/lib/dilonsoft/http";
import { setStock } from "@/lib/dilonsoft/channel";

export const PUT = apiRoute<{ id: string }>(async (request, { id }) => setStock(id, await readJson(request)));
