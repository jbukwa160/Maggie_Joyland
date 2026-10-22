import type { Metadata } from "next";
import { headers } from "next/headers";
import { Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listKeys } from "@/lib/dilonsoft/keys";
import { fmtDate } from "@/lib/admin/dates";
import { ActionButton } from "@/components/admin/forms";
import { Card, EmptyState, Notice, PageHeader, TableWrap, tdClass, thClass, trClass } from "@/components/admin/ui";
import { revokeApiKeyAction } from "./actions";
import { NewKeyForm } from "./ApiKeysClient";

export const metadata: Metadata = { title: "API и MCP" };

/** The address DilonSoft and MCP clients reach the shop on: SITE_URL, else this request's host. */
async function baseUrl(): Promise<string> {
  const configured = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border border-primary-100 bg-cream/60 p-3 font-mono text-xs leading-relaxed text-ink">{children}</pre>;
}

export default async function ApiPage() {
  await requireAdmin();
  const keys = listKeys();
  const base = await baseUrl();
  const mcpConfig = JSON.stringify(
    { mcpServers: { "maggie-joyland": { type: "http", url: `${base}/api/mcp`, headers: { Authorization: "Bearer <API ключ>" } } } },
    null,
    2,
  );

  return (
    <>
      <PageHeader
        title="API и MCP"
        description="Ключове за DilonSoft и за AI асистенти (MCP). С ключ се управлява магазинът така, както от този админ панел - поръчки, продукти, наличности, съдържание и настройки."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Нов ключ" description="Ключът действа с вашите права на администратор. Създайте отделен ключ за всяка връзка, за да можете да ги отменяте поотделно.">
          <NewKeyForm />
        </Card>

        <Card title="Свързване с DilonSoft">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-soft">
            <li>
              В DilonSoft: <strong>Настройки → Канали за продажба → Custom API → Добави акаунт</strong>.
            </li>
            <li>
              Адрес на сайта: <code className="font-mono text-ink">{base}</code>
            </li>
            <li>API ключ: създаденият тук. Натиснете „Тествай връзката“.</li>
            <li>
              След успешна проверка админ панелът на магазина се появява в DilonSoft в „Смени приложението“. Превключвателите „Импортирай поръчки“ и
              „Синхронизиране на наличности към канала“ пускат поръчките към DilonSoft и наличностите от DilonSoft към сайта.
            </li>
          </ol>
          <Notice tone="warning" className="mt-4" title="Наличности от едно място">
            Включете синхронизацията на наличности в DilonSoft само ако не качвате наличности и от „Импорт“ тук - иначе двете ще се презаписват.
          </Notice>
        </Card>
      </div>

      <Card title="Ключове" className="mt-6" bodyClassName="p-0">
        {keys.length ? (
          <TableWrap className="rounded-none border-0 shadow-none">
            <thead>
              <tr>
                <th className={thClass}>Име</th>
                <th className={thClass}>Ключ</th>
                <th className={thClass}>Създаден</th>
                <th className={thClass}>Последно ползван</th>
                <th className={thClass}>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={trClass}>
                  <td className={`${tdClass} font-bold text-ink`}>{k.label}</td>
                  <td className={`${tdClass} font-mono text-xs text-ink-muted`}>{k.prefix}…</td>
                  <td className={`${tdClass} text-sm text-ink-soft`}>
                    {fmtDate(new Date(k.createdAt), true)}
                    <div className="text-xs text-ink-muted">{k.createdBy}</div>
                  </td>
                  <td className={`${tdClass} text-sm text-ink-soft`}>{k.lastUsedAt ? fmtDate(new Date(k.lastUsedAt), true) : "още не"}</td>
                  <td className={`${tdClass} text-right`}>
                    <ActionButton
                      action={revokeApiKeyAction.bind(null, k.id)}
                      confirm={`Отмяна на ключа „${k.label}“? Връзките, които го ползват, спират веднага.`}
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Отмени
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <div className="p-5">
            <EmptyState title="Няма ключове" text="Създайте ключ, за да свържете DilonSoft или AI асистент." />
          </div>
        )}
      </Card>

      <Card title="MCP за AI асистенти (Claude и др.)" className="mt-6">
        <p className="mb-3 text-sm text-ink-soft">
          Адресът на MCP сървъра е <code className="font-mono text-ink">{base}/api/mcp</code> (Streamable HTTP), с ключа в заглавката <code className="font-mono">Authorization: Bearer …</code>.
          Асистентът вижда същите раздели и действия като този панел - преглед на поръчки, смяна на статуси, цени, наличности, съдържание.
        </p>
        <Code>{mcpConfig}</Code>
        <p className="mt-3 text-xs text-ink-muted">
          Claude Code: <code className="font-mono">claude mcp add --transport http maggie-joyland {base}/api/mcp --header &quot;Authorization: Bearer &lt;API ключ&gt;&quot;</code>
        </p>
      </Card>

      <Card title="REST API" className="mt-6">
        <p className="mb-3 text-sm text-ink-soft">
          Същият ключ отваря и REST API-то на адрес <code className="font-mono text-ink">{base}/api/dilonsoft/v1</code> (протокол „DilonSoft Custom API“ v1):
        </p>
        <Code>{`GET   /api/dilonsoft/v1                         за магазина и какво поддържа
GET   /api/dilonsoft/v1/orders?cursor=&limit=     поръчки, променени след курсора
GET   /api/dilonsoft/v1/orders/cancelled?since=   отказани поръчки
POST  /api/dilonsoft/v1/orders/{номер}/shipment   { carrier, tracking_number }
GET   /api/dilonsoft/v1/products?cursor=          продуктите (листинги)
PUT   /api/dilonsoft/v1/products/{id}/stock       { quantity }
GET   /api/dilonsoft/v1/admin                     описание на админ панела (раздели, полета, действия)
...   /api/dilonsoft/v1/admin/sections/{раздел}   списъци, записи, форми и действия`}</Code>
      </Card>
    </>
  );
}
