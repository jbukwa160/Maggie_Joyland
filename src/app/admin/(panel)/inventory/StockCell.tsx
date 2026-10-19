"use client";

import { QuickEdit } from "@/components/admin/QuickEdit";
import { quickUpdateProduct } from "../products/actions";

export function StockCell({ id, stock }: { id: number; stock: number }) {
  return <QuickEdit value={stock} kind="int" label="Количество на склад" onSave={(raw) => quickUpdateProduct(id, "stock", raw)} render={(v) => <span className="font-bold">{v}</span>} />;
}
