import { AlertTriangle, Baby, ExternalLink, Factory, Recycle, ShieldCheck, Users } from "lucide-react";
import type { Product } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getManufacturer } from "@/lib/manufacturers";
import { AUDIENCES, WARNINGS, formatAge, needsWeeeNote, type WarningKey } from "@/lib/toy-info";

/** Age, "for whom" chips shown next to the price. */
export function AgeChips({ product, locale, dict }: { product: Product; locale: Locale; dict: Dictionary }) {
  const age = formatAge(product.ageMin, product.ageMax, locale);
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {age && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1.5 font-bold text-secondary-600" title={product.ageSource === "rule" ? dict.safety.estimated : undefined}>
          <Baby className="size-4" /> {dict.safety.age}: {age}
          {product.ageSource === "rule" && <span className="font-semibold opacity-70">*</span>}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1.5 font-bold text-accent-700">
        <Users className="size-4" /> {AUDIENCES[product.audience][locale]}
      </span>
    </div>
  );
}

/** Safety warnings + GPSR manufacturer block (required before the order under EU toy and product safety rules). */
export function SafetyInfo({ product, locale, dict }: { product: Product; locale: Locale; dict: Dictionary }) {
  const warnings = product.warnings.filter((w): w is WarningKey => w in WARNINGS);
  const maker = getManufacturer(product.brand);
  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <section className="rounded-[1.5rem] border-2 border-warning/30 bg-warning-50 p-5">
          <h3 className="flex items-center gap-2 font-extrabold text-warning">
            <AlertTriangle className="size-5" /> {dict.safety.title}
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            {warnings.map((w) => (
              <li key={w}>
                <strong className="text-ink">{WARNINGS[w].label[locale]}.</strong> {WARNINGS[w].text[locale]}
              </li>
            ))}
          </ul>
          {needsWeeeNote(warnings) && (
            <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
              <Recycle className="mt-0.5 size-4 shrink-0" /> {dict.safety.weee}
            </p>
          )}
          {product.ageSource === "rule" && <p className="mt-3 text-xs text-ink-muted">* {dict.safety.age}: {dict.safety.estimated}</p>}
        </section>
      )}

      <section className="rounded-[1.5rem] bg-surface p-5 ring-1 ring-primary-100">
        <h3 className="flex items-center gap-2 font-extrabold">
          <ShieldCheck className="size-5 text-mint-600" /> {dict.safety.gpsrTitle}
        </h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {maker ? (
            <>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-muted">
                  <Factory className="size-3.5" /> {dict.safety.manufacturer}
                </dt>
                <dd className="mt-1 text-ink-soft">
                  <span className="font-bold text-ink">{maker.name}</span>
                  {maker.address && <span className="block">{maker.address}</span>}
                  {maker.email && <a href={`mailto:${maker.email}`} className="block text-accent-600 hover:underline">{maker.email}</a>}
                  {maker.website && (
                    <a href={maker.website.startsWith("http") ? maker.website : `https://${maker.website}`} target="_blank" rel="noopener noreferrer" className="block text-accent-600 hover:underline">
                      {maker.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </dd>
              </div>
              {maker.euName && (
                <div>
                  <dt className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">{dict.safety.euResponsible}</dt>
                  <dd className="mt-1 text-ink-soft">
                    <span className="font-bold text-ink">{maker.euName}</span>
                    {maker.euAddress && <span className="block">{maker.euAddress}</span>}
                    {maker.euEmail && <a href={`mailto:${maker.euEmail}`} className="block text-accent-600 hover:underline">{maker.euEmail}</a>}
                  </dd>
                </div>
              )}
            </>
          ) : (
            <p className="text-ink-soft sm:col-span-2">{dict.safety.gpsrMissing}</p>
          )}
          <div>
            <dt className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">{dict.safety.model}</dt>
            <dd className="mt-1 font-semibold">
              {product.sku.replace(/^Dilon-/, "")}
              {product.ean && <span className="block text-ink-soft">EAN {product.ean}</span>}
            </dd>
          </div>
          {product.batch && (
            <div>
              <dt className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">{dict.safety.batch}</dt>
              <dd className="mt-1 font-semibold">{product.batch}</dd>
            </div>
          )}
          {product.passportUrl && (
            <div>
              <dt className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">{dict.safety.passport}</dt>
              <dd className="mt-1">
                <a href={product.passportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-accent-600 hover:underline">
                  {product.passportUrl.replace(/^https?:\/\//, "").slice(0, 40)} <ExternalLink className="size-3.5" />
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
