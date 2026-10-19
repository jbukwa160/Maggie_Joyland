"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { Dialog } from "@/components/admin/Dialog";
import { FormError, SubmitButton, useAdminForm } from "@/components/admin/forms";
import { Button, Field, Select } from "@/components/admin/ui";

/** Delete button that asks where the category's products should go. */
export function DeleteCategory({
  action,
  name,
  productCount,
  childCount,
  options,
  compact,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  name: string;
  productCount: number;
  childCount: number;
  options: { id: number; name: string }[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useAdminForm(action);
  return (
    <>
      {compact ? (
        <Button variant="ghost" size="icon" className="text-danger" onClick={() => setOpen(true)} title="Изтрий" aria-label={`Изтрий ${name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>
          Изтрий
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={`Изтриване на „${name}“`}>
        <form onSubmit={onSubmit} data-dialog-form className="flex flex-col gap-4">
          {productCount > 0 ? (
            <Field label={`Къде да отидат ${productCount} продукта от категорията?`} htmlFor="targetId">
              <Select id="targetId" name="targetId" defaultValue="">
                <option value="">— Без категория —</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-ink-soft">В категорията няма продукти.</p>
          )}
          {childCount > 0 && <p className="text-sm text-ink-soft">Подкатегориите ({childCount}) ще станат основни категории.</p>}
          <FormError state={state} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Откажи
            </Button>
            <SubmitButton pending={pending} variant="danger" icon={false}>
              Изтрий категорията
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
