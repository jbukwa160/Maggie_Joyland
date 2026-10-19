import "server-only";
import { revalidatePath } from "next/cache";

/** Refresh admin pages after a mutation (and the storefront, which shows the same data). */
export function revalidateAdmin(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin", "layout");
}

/** Storefront pages render from the database; drop any cached copies after content changes. */
export function revalidateShop() {
  revalidatePath("/[locale]", "layout");
}

/** "1 продукт", "5 продукта". */
export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("bg-BG")} ${n === 1 ? one : many}`;
}
