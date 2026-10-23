// DilonSoft shipped the order: { carrier, tracking_number }. Safe to repeat.
import { apiRoute, readJson } from "@/lib/dilonsoft/http";
import { confirmShipment } from "@/lib/dilonsoft/channel";

export const POST = apiRoute<{ number: string }>(async (request, { number }) =>
  confirmShipment(decodeURIComponent(number), await readJson(request)),
);
