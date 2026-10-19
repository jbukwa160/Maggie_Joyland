import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// All money values are stored as integer cents (EUR).
const createdAt = () => integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const updatedAt = () => integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const bool = (name: string, def: boolean) => integer(name, { mode: "boolean" }).notNull().default(def);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  role: text("role", { enum: ["customer", "admin"] }).notNull().default("customer"),
  newsletter: bool("newsletter", false),
  /** Bonus points balance (Bonus programme). */
  points: integer("points").notNull().default(0),
  /** Bumped on password change: sessions signed with an older version are rejected ("sign out other devices"). */
  sessionVersion: integer("session_version").notNull().default(0),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const addresses = sqliteTable("addresses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default(""),
  postcode: text("postcode").notNull().default(""),
  address: text("address").notNull().default(""),
  isDefault: bool("is_default", false),
  createdAt: createdAt(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  /** Set for subcategories. Only one level of nesting is used. */
  parentId: integer("parent_id"),
  /** Icon name from CATEGORY_ICONS (src/lib/toy-info.ts) or "". */
  icon: text("icon").notNull().default(""),
  /** Accent colour (#rrggbb) for the tile / menu or "" for the brand colour. */
  color: text("color").notNull().default(""),
  nameBg: text("name_bg").notNull(),
  nameEn: text("name_en").notNull().default(""),
  descriptionBg: text("description_bg").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  image: text("image").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active", true),
  showOnHome: bool("show_on_home", true),
});

// "Shop by character / collection": Barbie, Frozen, unicorns...
export const themes = sqliteTable("themes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  nameBg: text("name_bg").notNull(),
  nameEn: text("name_en").notNull().default(""),
  image: text("image").notNull().default(""),
  // Comma separated keywords used by the importer to auto-tag products.
  keywords: text("keywords").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active", true),
  showOnHome: bool("show_on_home", true),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sku: text("sku").notNull().unique(),
    ean: text("ean").notNull().default(""),
    slug: text("slug").notNull().unique(),
    nameBg: text("name_bg").notNull(),
    nameEn: text("name_en").notNull().default(""),
    descriptionBg: text("description_bg").notNull().default(""),
    descriptionEn: text("description_en").notNull().default(""),
    brand: text("brand").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    price: integer("price").notNull().default(0),
    // Manual sale price. Used when onSale is true (and within the optional date window).
    salePrice: integer("sale_price"),
    onSale: bool("on_sale", false),
    saleStartsAt: integer("sale_starts_at", { mode: "timestamp" }),
    saleEndsAt: integer("sale_ends_at", { mode: "timestamp" }),
    stock: integer("stock").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    weight: real("weight").notNull().default(0),
    color: text("color").notNull().default(""),
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    isActive: bool("is_active", true),
    isFeatured: bool("is_featured", false),
    isNew: bool("is_new", false),
    // false for imported placeholder prices that still need to be checked by the shop owner.
    priceConfirmed: bool("price_confirmed", false),
    sourceCategory: text("source_category").notNull().default(""),
    searchText: text("search_text").notNull().default(""),
    /** Recommended age in months; ageMax null = "and up". Estimated by src/lib/import/toy-infer.ts unless ageSource = "admin". */
    ageMin: integer("age_min"),
    ageMax: integer("age_max"),
    /** name = read from the product name (reliable), rule = typical age for the brand/category (estimate). */
    ageSource: text("age_source", { enum: ["name", "rule", "admin", "none"] }).notNull().default("none"),
    audience: text("audience", { enum: ["girls", "boys", "all"] }).notNull().default("girls"),
    audienceSource: text("audience_source", { enum: ["auto", "admin"] }).notNull().default("auto"),
    /** Safety warning keys from WARNING_KEYS (src/lib/toy-info.ts). */
    warnings: text("warnings", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    warningsSource: text("warnings_source", { enum: ["auto", "admin"] }).notNull().default("auto"),
    /** GPSR: production batch / lot and link to the digital product passport. */
    batch: text("batch").notNull().default(""),
    passportUrl: text("passport_url").notNull().default(""),
    /** Supplier values from the CSV import, for "restore supplier data" in the admin. */
    original: text("original", { mode: "json" }).$type<Record<string, unknown>>(),
    /** Created by hand in the admin (not from the supplier export). */
    isCustom: bool("is_custom", false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_active_idx").on(t.isActive),
    index("products_brand_idx").on(t.brand),
  ],
);

export const productThemes = sqliteTable(
  "product_themes",
  {
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    themeId: integer("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.themeId] }), index("product_themes_theme_idx").on(t.themeId)],
);

// Percentage campaigns ("Black Friday -20%") applied to chosen products, a category, a theme or everything.
export const promotions = sqliteTable("promotions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameBg: text("name_bg").notNull(),
  nameEn: text("name_en").notNull().default(""),
  discountPercent: integer("discount_percent").notNull(),
  scope: text("scope", { enum: ["products", "category", "theme", "brand", "all"] }).notNull().default("products"),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  brand: text("brand").notNull().default(""),
  themeId: integer("theme_id").references(() => themes.id, { onDelete: "set null" }),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  isActive: bool("is_active", true),
  createdAt: createdAt(),
});

export const promotionProducts = sqliteTable(
  "promotion_products",
  {
    promotionId: integer("promotion_id").notNull().references(() => promotions.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.productId] }), index("promotion_products_product_idx").on(t.productId)],
);

export const banners = sqliteTable("banners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // hero = big homepage slider, promo = mid-page promo tiles, shop = top of the catalog page
  placement: text("placement", { enum: ["hero", "promo", "shop"] }).notNull().default("hero"),
  titleBg: text("title_bg").notNull().default(""),
  titleEn: text("title_en").notNull().default(""),
  subtitleBg: text("subtitle_bg").notNull().default(""),
  subtitleEn: text("subtitle_en").notNull().default(""),
  ctaBg: text("cta_bg").notNull().default(""),
  ctaEn: text("cta_en").notNull().default(""),
  link: text("link").notNull().default(""),
  image: text("image").notNull().default(""),
  // split = picture in an arched frame next to the text (good for product packshots),
  // full = picture covers the whole banner with the text on top (good for lifestyle photos).
  layout: text("layout", { enum: ["split", "full"] }).notNull().default("split"),
  // Pastel background used by the split layout.
  background: text("background", { enum: ["pink", "lilac", "cream", "mint", "gold"] }).notNull().default("pink"),
  textAlign: text("text_align", { enum: ["left", "center", "right"] }).notNull().default("left"),
  textTone: text("text_tone", { enum: ["dark", "light"] }).notNull().default("dark"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active", true),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

export const pages = sqliteTable("pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  titleBg: text("title_bg").notNull(),
  titleEn: text("title_en").notNull().default(""),
  // Simple markdown (headings, lists, links, bold).
  contentBg: text("content_bg").notNull().default(""),
  contentEn: text("content_en").notNull().default(""),
  isActive: bool("is_active", true),
  showInFooter: bool("show_in_footer", true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: updatedAt(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const orderStatuses = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const carriers = ["speedy", "econt", "boxnow"] as const;
export type CarrierId = (typeof carriers)[number];
export const deliveryTypes = ["office", "address", "locker"] as const;
export type DeliveryType = (typeof deliveryTypes)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: orderStatuses }).notNull().default("new"),
    paymentMethod: text("payment_method", { enum: ["cod", "bank"] }).notNull().default("cod"),
    paymentStatus: text("payment_status", { enum: ["pending", "paid", "refunded"] }).notNull().default("pending"),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    carrier: text("carrier", { enum: carriers }).notNull(),
    deliveryType: text("delivery_type", { enum: deliveryTypes }).notNull(),
    // Courier office / locker chosen by the customer.
    officeId: text("office_id").notNull().default(""),
    officeName: text("office_name").notNull().default(""),
    // Courier specific city/site id (Speedy siteId, Econt city id) when known.
    cityId: text("city_id").notNull().default(""),
    city: text("city").notNull().default(""),
    postcode: text("postcode").notNull().default(""),
    address: text("address").notNull().default(""),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    shippingPrice: integer("shipping_price").notNull().default(0),
    total: integer("total").notNull(),
    couponCode: text("coupon_code").notNull().default(""),
    /** Bonus points: earned by this order (credited on delivery) and spent on it. */
    pointsEarned: integer("points_earned").notNull().default(0),
    pointsUsed: integer("points_used").notNull().default(0),
    pointsDiscount: integer("points_discount").notNull().default(0),
    pointsCredited: bool("points_credited", false),
    notes: text("notes").notNull().default(""),
    adminNotes: text("admin_notes").notNull().default(""),
    locale: text("locale").notNull().default("bg"),
    trackingNumber: text("tracking_number").notNull().default(""),
    shipmentId: text("shipment_id").notNull().default(""),
    shipmentData: text("shipment_data", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)],
);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  image: text("image").notNull().default(""),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
});

export const orderEvents = sqliteTable("order_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
});

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["percent", "fixed"] }).notNull().default("percent"),
  // percent: whole percent (10 = 10%); fixed: cents
  value: integer("value").notNull(),
  minSubtotal: integer("min_subtotal").notNull().default(0),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: bool("is_active", true),
  createdAt: createdAt(),
});

export const subscribers = sqliteTable("subscribers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  locale: text("locale").notNull().default("bg"),
  createdAt: createdAt(),
});

// Cached courier nomenclatures (offices, cities, lockers).
export const carrierCache = sqliteTable("carrier_cache", {
  key: text("key").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  updatedAt: updatedAt(),
});

// GPSR manufacturer / EU responsible person per brand, shown on every product of the brand.
export const manufacturers = sqliteTable("manufacturers", {
  brand: text("brand").primaryKey(),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  euName: text("eu_name").notNull().default(""),
  euAddress: text("eu_address").notNull().default(""),
  euEmail: text("eu_email").notNull().default(""),
  updatedAt: updatedAt(),
});

export const blogPosts = sqliteTable("blog_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  titleBg: text("title_bg").notNull(),
  titleEn: text("title_en").notNull().default(""),
  excerptBg: text("excerpt_bg").notNull().default(""),
  excerptEn: text("excerpt_en").notNull().default(""),
  /** Blog markup (src/lib/blog-markup.tsx): markdown subset + tips, images, product cards, buttons. */
  bodyBg: text("body_bg").notNull().default(""),
  bodyEn: text("body_en").notNull().default(""),
  cover: text("cover").notNull().default(""),
  /** Pastel background used when there is no cover picture. */
  coverColor: text("cover_color", { enum: ["pink", "lilac", "cream", "mint", "gold"] }).notNull().default("pink"),
  topic: text("topic").notNull().default(""),
  metaTitleBg: text("meta_title_bg").notNull().default(""),
  metaTitleEn: text("meta_title_en").notNull().default(""),
  metaDescriptionBg: text("meta_description_bg").notNull().default(""),
  metaDescriptionEn: text("meta_description_en").notNull().default(""),
  published: bool("published", false),
  /** A future date schedules the article. */
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Old addresses of renamed articles (permanent redirect to the post). */
export const blogRedirects = sqliteTable("blog_redirects", {
  oldSlug: text("old_slug").primaryKey(),
  postId: integer("post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
});

export const chatConversations = sqliteTable(
  "chat_conversations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** sha256 of the visitor cookie token. */
    tokenHash: text("token_hash").notNull().unique(),
    name: text("name").notNull().default(""),
    contact: text("contact").notNull().default(""),
    page: text("page").notNull().default(""),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    locale: text("locale").notNull().default("bg"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    unreadAdmin: integer("unread_admin").notNull().default(0),
    unreadVisitor: integer("unread_visitor").notNull().default(0),
    createdAt: createdAt(),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("chat_conversations_last_idx").on(t.lastMessageAt)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["visitor", "admin"] }).notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_messages_conversation_idx").on(t.conversationId, t.id)],
);

/** "Gift ideas": hand-picked products in ordered sections. */
export const giftSections = sqliteTable("gift_sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  titleBg: text("title_bg").notNull(),
  titleEn: text("title_en").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: bool("is_active", true),
});

export const giftItems = sqliteTable(
  "gift_items",
  {
    sectionId: integer("section_id").notNull().references(() => giftSections.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.productId] })],
);

/** History of bonus point changes (orders and manual adjustments in the admin). */
export const pointsLog = sqliteTable(
  "points_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    note: text("note").notNull().default(""),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    adminId: integer("admin_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("points_log_user_idx").on(t.userId)],
);

/** Failed sign-ins per IP / e-mail for the login lockout. */
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  firstAt: integer("first_at", { mode: "timestamp" }).notNull(),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
});

/** Uploaded price files waiting for the admin's confirmation (preview before applying). */
export const priceImports = sqliteTable("price_imports", {
  id: text("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Theme = typeof themes.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Manufacturer = typeof manufacturers.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type GiftSection = typeof giftSections.$inferSelect;
