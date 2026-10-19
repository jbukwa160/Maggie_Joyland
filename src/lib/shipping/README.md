# Куриери / Couriers (Speedy, Econt, BOX NOW)

**BG:** Магазинът показва офиси/автомати при поръчка и създава товарителници от админ панела
(`createShipmentForOrder` / `cancelShipmentForOrder` в `actions.ts`, етикет: `/api/admin/shipping/label?orderId=…`).
Проверка на данните за достъп: `/api/admin/shipping/test` (само четене, не създава пратки).
Списъците с населени места, офиси и автомати се кешират за 24 часа в таблица `carrier_cache`.

**EN:** Checkout uses the public `/api/shipping/cities` and `/api/shipping/offices` endpoints; the admin panel uses the
server actions in `actions.ts`. Client components import from `@/lib/shipping/types` only (`index.ts` is server-only).
Nomenclatures are cached for 24h in `carrier_cache` (stale copies are served while refreshing in the background).
Money is stored in cents and sent to couriers as decimal EUR. Phone numbers are sent as `+359…`.

| Courier | How it works | Env vars |
| --- | --- | --- |
| Speedy | REST API v1 `https://api.speedy.bg/v1`, user/password in every JSON body. Sites from `/location/site/csv/100`, offices + APT lockers from `/location/office`. Shipment: service 505 (СТАНДАРТ 24 ЧАСА), sender pays, COD `CASH` in EUR, ref1 = order number. Label: `/print` A6. | `SPEEDY_USERNAME`, `SPEEDY_PASSWORD`, optional `SPEEDY_SERVICE_ID` (505), `SPEEDY_PAYER` (`SENDER`) |
| Econt | JSON API `https://ee.econt.com/services/` (or demo), HTTP Basic auth. Cities/offices are public nomenclatures (APS = locker). `LabelService.createLabel` (mode `create`), label PDF from the returned `pdfURL`, cancel with `LabelService.deleteLabels`. | `ECONT_USERNAME`, `ECONT_PASSWORD`, `ECONT_ENV` (`production` / `demo`), optional `ECONT_SENDER_PAYMENT` (`cash` / `credit`, empty = account default) |
| BOX NOW | Partner API (same calls as the official WooCommerce plugin): `auth-sessions` token, `destinations` lockers, `delivery-requests`, `parcels/{id}/label.pdf`, `parcels/{id}:cancel`. Origin = `BOXNOW_WAREHOUSE_ID`. | `BOXNOW_API_URL`, `BOXNOW_CLIENT_ID`, `BOXNOW_CLIENT_SECRET`, `BOXNOW_WAREHOUSE_ID`, optional `BOXNOW_COMPARTMENT_SIZE` (1-3, default 2). `BOXNOW_PARTNER_ID` is not needed by these API calls (the plugin does not send it either). |

Live prices (`settings.shipping.priceMode = "courier"`): `quoteShipping()` in `index.ts` asks Speedy (`/calculate`) or
Econt (`createLabel` with mode `calculate`) for the price in cents incl. VAT, cached 10 min in memory; BOX NOW has no
price API, so `null` is returned and the fixed price applies.

Sender data (name, phone, email, address, Speedy/Econt drop-off office) comes from **Настройки → Доставка**
(`settings.shipping.sender`); parcel weight from product weights or `settings.shipping.defaultWeight`.
