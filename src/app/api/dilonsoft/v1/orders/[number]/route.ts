// One order by its number (MJ100023), in the same shape as the order list.
import { apiRoute } from "@/lib/dilonsoft/http";
import { getChannelOrder } from "@/lib/dilonsoft/channel";

export const GET = apiRoute<{ number: string }>(async (_request, { number }) => getChannelOrder(decodeURIComponent(number)));
