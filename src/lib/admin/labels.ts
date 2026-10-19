// Bulgarian labels used across the admin panel (safe for client components).
import type { CarrierId, DeliveryType, OrderStatus } from "@/db/schema";

export type Tone = "neutral" | "pink" | "lilac" | "success" | "warning" | "danger" | "gold";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Нова",
  confirmed: "Потвърдена",
  processing: "Обработва се",
  shipped: "Изпратена",
  delivered: "Доставена",
  cancelled: "Отказана",
  returned: "Върната",
};

export const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
  new: "pink",
  confirmed: "lilac",
  processing: "gold",
  shipped: "lilac",
  delivered: "success",
  cancelled: "danger",
  returned: "warning",
};

export const PAYMENT_METHOD_LABELS: Record<"cod" | "bank", string> = {
  cod: "Наложен платеж",
  bank: "Банков превод",
};

export const PAYMENT_STATUS_LABELS: Record<"pending" | "paid" | "refunded", string> = {
  pending: "Очаква плащане",
  paid: "Платена",
  refunded: "Възстановена сума",
};

export const PAYMENT_STATUS_TONES: Record<"pending" | "paid" | "refunded", Tone> = {
  pending: "warning",
  paid: "success",
  refunded: "neutral",
};

export const CARRIER_LABELS: Record<CarrierId, string> = { speedy: "Спиди", econt: "Еконт", boxnow: "BOX NOW" };

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  office: "До офис",
  address: "До адрес",
  locker: "До автомат",
};

export const BANNER_PLACEMENTS = {
  hero: { label: "Главен слайдер", hint: "Големите банери най-горе на началната страница." },
  promo: { label: "Промо плочки", hint: "Плочките в средата на началната страница." },
  shop: { label: "Банер в каталога", hint: "Показва се най-горе в страницата с продукти." },
} as const;

export const BANNER_BACKGROUNDS = {
  pink: { label: "Розов", className: "bg-primary-100" },
  lilac: { label: "Лилав", className: "bg-secondary-100" },
  cream: { label: "Кремав", className: "bg-cream-dark" },
  mint: { label: "Мента", className: "bg-mint-100" },
  gold: { label: "Златист", className: "bg-gold-100" },
} as const;

export const PROMO_SCOPE_LABELS = {
  products: "Избрани продукти",
  category: "Цяла категория",
  brand: "Марка",
  theme: "Герой / колекция",
  all: "Целия магазин",
} as const;

export const VALUE_PROP_ICONS = ["truck", "gift", "shield", "heart", "star", "sparkles", "phone", "smile"] as const;

export const VALUE_PROP_ICON_LABELS: Record<(typeof VALUE_PROP_ICONS)[number], string> = {
  truck: "Камионче",
  gift: "Подарък",
  shield: "Щит",
  heart: "Сърце",
  star: "Звезда",
  sparkles: "Искрици",
  phone: "Телефон",
  smile: "Усмивка",
};
