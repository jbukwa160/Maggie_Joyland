import { z } from "zod";
import { MENU_STYLES } from "@/lib/settings-defaults";
import { UI_ICONS } from "@/lib/toy-info";
import { zImageUrl, zLink } from "./form";

// Validation of the top menu edited in Admin → Меню (settings.menu).
const hex = z.string().regex(/^$|^#[0-9a-f]{6}$/i, "Цветът трябва да е във формат #RRGGBB.");
const id = z.string().min(1).max(40);
const label = z.string().max(60, "Надписът е твърде дълъг.");

const link = z.object({ id, labelBg: z.string().min(1, "Всяка връзка трябва да има надпис.").max(60), labelEn: label, href: zLink.refine((v) => v !== "", "Изберете накъде води връзката.") });

const column = z.object({
  id,
  kind: z.enum(["links", "image"]),
  titleBg: label,
  titleEn: label,
  href: zLink,
  image: zImageUrl,
  links: z.array(link).max(20, "Най-много 20 връзки в колона."),
});

const item = z
  .object({
    id,
    kind: z.enum(["link", "dropdown", "gifts", "categories"], { message: "Невалиден вид елемент." }),
    labelBg: z.string().min(1, "Всеки елемент трябва да има надпис.").max(60, "Надписът е твърде дълъг."),
    labelEn: label,
    href: zLink,
    appearance: z.object({
      style: z.enum(Object.keys(MENU_STYLES) as [keyof typeof MENU_STYLES, ...(keyof typeof MENU_STYLES)[]], { message: "Невалиден външен вид." }),
      color: hex,
      color2: hex,
      icon: z.enum(UI_ICONS, { message: "Невалидна икона." }),
    }),
    columns: z.array(column).max(5, "Падащото меню може да има най-много 5 колони."),
    enabled: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "link" && !d.href) ctx.addIssue({ code: "custom", path: ["href"], message: `„${d.labelBg}“: изберете накъде води.` });
    if (d.kind === "dropdown" && !d.columns.length) ctx.addIssue({ code: "custom", path: ["columns"], message: `„${d.labelBg}“: добавете поне една колона.` });
    d.columns.forEach((c, i) => {
      if (c.kind === "image" && !c.image) ctx.addIssue({ code: "custom", path: ["columns", i, "image"], message: `„${d.labelBg}“: колона ${i + 1} няма снимка.` });
    });
  });

export const menuSchema = z.object({ items: z.array(item).max(20, "Най-много 20 елемента в менюто.") });

