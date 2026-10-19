"use client";

import { useRef, useState, useTransition } from "react";
import { Ban, Download, ExternalLink, Loader2, Truck } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import type { ActionState } from "@/lib/admin/action-state";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/admin/labels";
import { cancelShipmentForOrder, createShipmentForOrder } from "@/lib/shipping/actions";
import { FormError, SubmitButton, useAdminForm } from "@/components/admin/forms";
import { useToast } from "@/components/admin/Toast";
import { Button, Checkbox, Field, Input, Select, Textarea, buttonClass } from "@/components/admin/ui";

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const STATUS_HINTS: Partial<Record<OrderStatus, string>> = {
  cancelled: "Количествата ще се върнат в наличност, начислените бонус точки ще се отнемат, а използваните – върнат на клиента.",
  returned: "Количествата ще се върнат в наличност, начислените бонус точки ще се отнемат, а използваните – върнат на клиента.",
  delivered: "Клиентът получава бонус точките си. При наложен платеж плащането се отбелязва като получено.",
};

export function StatusForm({ action, current, statuses }: { action: FormAction; current: OrderStatus; statuses: readonly OrderStatus[] }) {
  const [status, setStatus] = useState<OrderStatus>(current);
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useAdminForm(action, { onSuccess: () => formRef.current?.reset() });
  const reopening = (current === "cancelled" || current === "returned") && status !== "cancelled" && status !== "returned";
  const hint = status !== current ? (reopening ? "Количествата ще бъдат извадени от наличност отново." : STATUS_HINTS[status]) : undefined;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="Нов статус" htmlFor="status" hint={hint}>
        <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.currentTarget.value as OrderStatus)}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
              {s === current ? " (текущ)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Бележка (по желание)" htmlFor="note" hint="Записва се в историята на поръчката.">
        <Textarea id="note" name="note" rows={2} placeholder="напр. Клиентът потвърди по телефона" />
      </Field>
      <FormError state={state} />
      <div>
        <SubmitButton pending={pending}>{status === current ? "Добави бележка" : "Промени статуса"}</SubmitButton>
      </div>
    </form>
  );
}

export function PaymentForm({ action, current }: { action: FormAction; current: "pending" | "paid" | "refunded" }) {
  const { pending, onSubmit } = useAdminForm(action);
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <Field label="Статус на плащането" htmlFor="paymentStatus" className="flex-1">
        <Select id="paymentStatus" name="paymentStatus" defaultValue={current}>
          {(["pending", "paid", "refunded"] as const).map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pending={pending} variant="secondary" icon={false}>
        Запази
      </SubmitButton>
    </form>
  );
}

export function NotesForm({ action, initial }: { action: FormAction; initial: string }) {
  const { pending, onSubmit } = useAdminForm(action);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Textarea name="adminNotes" rows={4} defaultValue={initial} placeholder="Вътрешни бележки – клиентът не ги вижда." aria-label="Вътрешни бележки" />
      <div>
        <SubmitButton pending={pending} variant="secondary" size="sm">
          Запази бележките
        </SubmitButton>
      </div>
    </form>
  );
}

/** Courier waybill: create (paid courier API!) or show / cancel the existing one. */
export function ShipmentBox({
  orderId,
  carrierName,
  carrier,
  trackingNumber,
  trackingHref,
  defaultWeight,
  cancelled,
  declaredValueHint,
}: {
  orderId: number;
  carrierName: string;
  carrier: string;
  trackingNumber: string;
  trackingHref: string;
  defaultWeight: number;
  cancelled: boolean;
  declaredValueHint: string;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [weight, setWeight] = useState(String(defaultWeight));
  const [parcels, setParcels] = useState("1");
  const [declare, setDeclare] = useState(false);
  const [boxSize, setBoxSize] = useState<"1" | "2" | "3">("2");

  if (trackingNumber) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl bg-mint-100 p-3">
          <p className="text-xs font-bold text-mint-600">Товарителница ({carrierName})</p>
          <p className="font-mono text-lg font-extrabold text-ink">{trackingNumber}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {trackingHref && (
            <a href={trackingHref} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
              <ExternalLink className="h-3.5 w-3.5" /> Проследи
            </a>
          )}
          <a href={`/api/admin/shipping/label?orderId=${orderId}`} target="_blank" rel="noopener" className={buttonClass("primary", "sm")}>
            <Download className="h-3.5 w-3.5" /> Свали етикет (PDF)
          </a>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={pending}
            icon={pending ? undefined : Ban}
            onClick={() => {
              if (!window.confirm(`Анулиране на товарителница ${trackingNumber} в ${carrierName}?`)) return;
              setError("");
              start(async () => {
                const res = await cancelShipmentForOrder(orderId);
                if (res.ok) toast("Товарителницата е анулирана.");
                else {
                  setError(res.error ?? "Анулирането не успя.");
                  toast(res.error ?? "Анулирането не успя.", "error");
                }
              });
            }}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Анулирай товарителница
          </Button>
        </div>
        {error && <p className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger">{error}</p>}
      </div>
    );
  }

  if (cancelled) return <p className="text-sm text-ink-muted">Поръчката е отказана – не може да се създаде товарителница.</p>;

  const create = () => {
    const w = Number(weight.replace(",", "."));
    const p = Number(parcels);
    if (!Number.isFinite(w) || w <= 0) return setError("Въведете тегло в килограми.");
    if (!Number.isInteger(p) || p < 1 || p > 10) return setError("Броят пакети трябва да е между 1 и 10.");
    if (!window.confirm(`Създаване на товарителница в ${carrierName}? Това е реална пратка в системата на куриера.`)) return;
    setError("");
    start(async () => {
      const res = await createShipmentForOrder(orderId, {
        weightKg: w,
        parcels: p,
        declareValue: declare,
        ...(carrier === "boxnow" ? { boxSize: Number(boxSize) as 1 | 2 | 3 } : {}),
      });
      if (res.ok) toast(`Товарителница ${res.trackingNumber} е създадена.`);
      else {
        setError(res.error);
        toast("Товарителницата не беше създадена.", "error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Тегло (кг)" htmlFor="ship-weight" hint="Изчислено от продуктите">
          <Input id="ship-weight" value={weight} onChange={(e) => setWeight(e.currentTarget.value)} inputMode="decimal" />
        </Field>
        <Field label="Брой пакети" htmlFor="ship-parcels">
          <Input id="ship-parcels" value={parcels} onChange={(e) => setParcels(e.currentTarget.value)} inputMode="numeric" />
        </Field>
      </div>
      {carrier === "boxnow" && (
        <Field label="Размер на клетката" htmlFor="ship-box">
          <Select id="ship-box" value={boxSize} onChange={(e) => setBoxSize(e.currentTarget.value as "1" | "2" | "3")}>
            <option value="1">Малка</option>
            <option value="2">Средна</option>
            <option value="3">Голяма</option>
          </Select>
        </Field>
      )}
      <Checkbox checked={declare} onChange={(e) => setDeclare(e.currentTarget.checked)} label={`Обявена стойност (${declaredValueHint})`} />
      <div>
        <Button onClick={create} disabled={pending} icon={pending ? undefined : Truck}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Създай товарителница
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-50 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
