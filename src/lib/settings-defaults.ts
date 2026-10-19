// Default values for everything the shop owner can change in /admin/settings.
// Kept free of server-only imports so client components can use the types.

export type ShippingMethodId = "speedy_office" | "speedy_address" | "econt_office" | "econt_address" | "boxnow_locker" | "pigeon_office" | "pigeon_address";

export type ShippingMethodConfig = {
  enabled: boolean;
  /** Price in cents. */
  price: number;
  labelBg: string;
  labelEn: string;
};

export type ValueProp = { icon: string; titleBg: string; titleEn: string; textBg: string; textEn: string; href?: string };

export type SiteSettings = {
  general: {
    siteName: string;
    taglineBg: string;
    taglineEn: string;
    logoUrl: string;
    contactEmail: string;
    contactPhone: string;
    addressBg: string;
    addressEn: string;
    workingHoursBg: string;
    workingHoursEn: string;
    footerTextBg: string;
    footerTextEn: string;
  };
  social: {
    youtube: string;
    facebook: string;
    instagram: string;
    tiktok: string;
  };
  youtube: {
    showOnHome: boolean;
    channelUrl: string;
    titleBg: string;
    titleEn: string;
    textBg: string;
    textEn: string;
    /** YouTube video ids or full URLs to embed on the home page. */
    videos: string[];
  };
  announcement: {
    enabled: boolean;
    textBg: string;
    textEn: string;
    link: string;
  };
  /** Brand colours. Every Tailwind colour in the shop is derived from these (see globals.css). */
  theme: {
    primary: string;
    accent: string;
    secondary: string;
    cream: string;
    ink: string;
    gold: string;
    mint: string;
  };
  shop: {
    hideOutOfStock: boolean;
    lowStockThreshold: number;
    productsPerPage: number;
    newBadgeDays: number;
  };
  shipping: {
    /** Cents. 0 disables free shipping. */
    freeShippingThreshold: number;
    methods: Record<ShippingMethodId, ShippingMethodConfig>;
    codEnabled: boolean;
    /** Extra fee for cash on delivery, cents. */
    codFee: number;
    bankEnabled: boolean;
    bankDetailsBg: string;
    bankDetailsEn: string;
    /** Sender data used when creating shipments. */
    sender: {
      name: string;
      contactName: string;
      phone: string;
      email: string;
      city: string;
      postcode: string;
      address: string;
      /** Econt office code the parcels are dropped at (empty = pickup from address). */
      econtOfficeCode: string;
      /** Speedy office id the parcels are dropped at (empty = pickup from address). */
      speedyOfficeId: string;
      /** Pigeon Express office id the parcels are dropped at (empty = pickup from address). */
      pigeonOfficeId: string;
    };
    /** Default parcel weight in kg when products have no weight. */
    defaultWeight: number;
    /** "courier": live price from the courier API for the order's weight (fixed prices are the fallback); "fixed": always the fixed prices. */
    priceMode: "fixed" | "courier";
    returnDays: number;
    deliveryDaysBg: string;
    deliveryDaysEn: string;
  };
  home: {
    showCategories: boolean;
    showThemes: boolean;
    showFeatured: boolean;
    showNew: boolean;
    showSale: boolean;
    showValueProps: boolean;
    showNewsletter: boolean;
    showBlog: boolean;
    showGifts: boolean;
    showBonus: boolean;
    categoriesTitleBg: string;
    categoriesTitleEn: string;
    themesTitleBg: string;
    themesTitleEn: string;
    featuredTitleBg: string;
    featuredTitleEn: string;
    newTitleBg: string;
    newTitleEn: string;
    saleTitleBg: string;
    saleTitleEn: string;
    newsletterTitleBg: string;
    newsletterTitleEn: string;
    newsletterTextBg: string;
    newsletterTextEn: string;
    valueProps: ValueProp[];
    /** Folded corner on the hero banner ("Момчетата от другата страна"); empty link = caption only. */
    teaserEnabled: boolean;
    teaserTextBg: string;
    teaserTextEn: string;
    teaserLink: string;
  };
  seo: {
    titleBg: string;
    titleEn: string;
    descriptionBg: string;
    descriptionEn: string;
  };
  /** Legal details of the merchant (terms, footer, invoices). */
  company: {
    legalName: string;
    eik: string;
    vatNumber: string;
    registeredAddress: string;
    manager: string;
  };
  /** Bonus programme: points for every euro spent, redeemable at checkout by registered customers. */
  bonus: {
    enabled: boolean;
    /** Points per whole euro of products (shipping excluded). */
    perEuro: number;
    /** Value of one point in cents when redeemed (e.g. 5 = 100 points → 5 €). */
    redeemValue: number;
    /** Minimum points needed to redeem. */
    minRedeem: number;
    titleBg: string;
    titleEn: string;
    textBg: string;
    textEn: string;
  };
  /** Top menu bar under the header (Admin → Меню). */
  menu: MenuConfig;
  /** "Gift ideas" page (Admin → Идеи за подаръци). */
  gifts: {
    enabled: boolean;
    /** Show suggested products automatically while no sections are set up. */
    autoSuggest: boolean;
    menuLabelBg: string;
    menuLabelEn: string;
    titleBg: string;
    titleEn: string;
    textBg: string;
    textEn: string;
  };
  /** Chat bubble (Admin → Чат). */
  chat: {
    enabled: boolean;
    titleBg: string;
    titleEn: string;
    greetingBg: string;
    greetingEn: string;
    /** Shown when nobody has the admin panel open. */
    offlineTextBg: string;
    offlineTextEn: string;
    quickQuestionsBg: string[];
    quickQuestionsEn: string[];
    /** Ask the visitor for a phone / e-mail after the first message. */
    askContact: boolean;
  };
};

// ─── Top menu ──────────────────────────────────────────────────────────────────

export const MENU_STYLES = {
  plain: "Обикновен",
  text: "Цветен текст",
  pill: "Цветен бутон",
  outline: "С рамка",
  gradient: "Преливащ цвят",
} as const;
export type MenuStyle = keyof typeof MENU_STYLES;

export type MenuAppearance = {
  style: MenuStyle;
  /** Main colour (#rrggbb): text, button or gradient start. Empty = brand accent. */
  color: string;
  /** Gradient end colour (#rrggbb). */
  color2: string;
  /** Icon name from UI_ICONS in src/lib/toy-info.ts. */
  icon: string;
};

export type MenuLink = { id: string; labelBg: string; labelEn: string; href: string };

/** A dropdown column: a list of links or a picture with a link. */
export type MenuColumn = {
  id: string;
  kind: "links" | "image";
  titleBg: string;
  titleEn: string;
  href: string;
  image: string;
  links: MenuLink[];
};

export type MenuItem = {
  id: string;
  /** link = plain link; dropdown = up to 5 columns; gifts = "Gift ideas" page; categories = all-categories mega menu. */
  kind: "link" | "dropdown" | "gifts" | "categories";
  labelBg: string;
  labelEn: string;
  /** link: target. dropdown: optional "See all" link. */
  href: string;
  appearance: MenuAppearance;
  columns: MenuColumn[];
  enabled: boolean;
};

export type MenuConfig = { items: MenuItem[] };

export const DEFAULT_APPEARANCE: MenuAppearance = { style: "plain", color: "", color2: "", icon: "none" };

export const DEFAULT_SETTINGS: SiteSettings = {
  general: {
    siteName: "Maggie Joyland",
    taglineBg: "Магазин за играчки за момичета",
    taglineEn: "A toy shop for girls",
    logoUrl: "",
    contactEmail: "hello@maggiejoyland.bg",
    contactPhone: "+359 888 000 000",
    addressBg: "София, България",
    addressEn: "Sofia, Bulgaria",
    workingHoursBg: "Пон – Пет: 9:00 – 18:00",
    workingHoursEn: "Mon – Fri: 9:00 – 18:00",
    footerTextBg:
      "Кукли, плюшени приятели, бижута и творчески комплекти, подбрани с любов за малки принцеси и големи мечтателки.",
    footerTextEn: "Dolls, plush friends, jewellery and craft kits picked with love for little princesses and big dreamers.",
  },
  social: {
    youtube: "https://www.youtube.com/@MaggieJoyland",
    facebook: "",
    instagram: "",
    tiktok: "",
  },
  youtube: {
    showOnHome: true,
    channelUrl: "https://www.youtube.com/@MaggieJoyland",
    titleBg: "Гледай ни в YouTube",
    titleEn: "Watch us on YouTube",
    textBg: "Ревюта на играчки, разопаковане на изненади и забавни идеи за игра – всяка седмица в канала на Maggie Joyland.",
    textEn: "Toy reviews, surprise unboxings and fun play ideas – every week on the Maggie Joyland channel.",
    videos: [],
  },
  announcement: {
    enabled: true,
    textBg: "Безплатна доставка за поръчки над 50 € 🎀",
    textEn: "Free delivery on orders over €50 🎀",
    link: "",
  },
  theme: {
    primary: "#f2a7bb",
    accent: "#d6618a",
    secondary: "#c8b4e3",
    cream: "#fff8f5",
    ink: "#5b3a4b",
    gold: "#d9b27c",
    mint: "#b9e2d3",
  },
  shop: {
    hideOutOfStock: true,
    lowStockThreshold: 3,
    productsPerPage: 24,
    newBadgeDays: 45,
  },
  shipping: {
    freeShippingThreshold: 5000,
    methods: {
      speedy_office: { enabled: true, price: 390, labelBg: "Спиди – до офис", labelEn: "Speedy – to office" },
      speedy_address: { enabled: true, price: 540, labelBg: "Спиди – до адрес", labelEn: "Speedy – to address" },
      econt_office: { enabled: true, price: 370, labelBg: "Еконт – до офис", labelEn: "Econt – to office" },
      econt_address: { enabled: true, price: 520, labelBg: "Еконт – до адрес", labelEn: "Econt – to address" },
      boxnow_locker: { enabled: true, price: 290, labelBg: "BOX NOW – до автомат", labelEn: "BOX NOW – to locker" },
      pigeon_office: { enabled: true, price: 290, labelBg: "Pigeon Express – до офис или автомат", labelEn: "Pigeon Express – to office or locker" },
      pigeon_address: { enabled: true, price: 390, labelBg: "Pigeon Express – до адрес", labelEn: "Pigeon Express – to address" },
    },
    codEnabled: true,
    codFee: 0,
    bankEnabled: true,
    bankDetailsBg: "IBAN: BG00 XXXX 0000 0000 0000 00\nПолучател: АРФА ЕС ЕООД\nОснование: номерът на поръчката",
    bankDetailsEn: "IBAN: BG00 XXXX 0000 0000 0000 00\nBeneficiary: ARFA ES EOOD\nReference: your order number",
    sender: {
      name: "АРФА ЕС ЕООД",
      contactName: "",
      phone: "",
      email: "",
      city: "София",
      postcode: "",
      address: "",
      econtOfficeCode: "",
      speedyOfficeId: "",
      pigeonOfficeId: "",
    },
    defaultWeight: 1,
    priceMode: "fixed",
    returnDays: 14,
    deliveryDaysBg: "1–2 работни дни",
    deliveryDaysEn: "1–2 working days",
  },
  home: {
    showCategories: true,
    showThemes: true,
    showFeatured: true,
    showNew: true,
    showSale: true,
    showValueProps: true,
    showNewsletter: true,
    showBlog: true,
    showGifts: true,
    showBonus: true,
    categoriesTitleBg: "Пазарувай по категория",
    categoriesTitleEn: "Shop by category",
    themesTitleBg: "Любими герои",
    themesTitleEn: "Favourite characters",
    featuredTitleBg: "Любими на Маги",
    featuredTitleEn: "Maggie's favourites",
    newTitleBg: "Ново в магазина",
    newTitleEn: "New arrivals",
    saleTitleBg: "Сладки намаления",
    saleTitleEn: "Sweet deals",
    newsletterTitleBg: "Писмо с панделка",
    newsletterTitleEn: "A letter with a bow",
    newsletterTextBg: "Абонирай се за новини, нови кукли и специални отстъпки само за абонати.",
    newsletterTextEn: "Subscribe for news, new dolls and subscriber-only discounts.",
    valueProps: [
      { icon: "truck", titleBg: "Бърза доставка", titleEn: "Fast delivery", textBg: "Спиди, Еконт и BOX NOW в цялата страна", textEn: "Speedy, Econt and BOX NOW nationwide" },
      { icon: "gift", titleBg: "Опаковане за подарък", titleEn: "Gift wrapping", textBg: "Всяка поръчка пристига с панделка", textEn: "Every order arrives with a bow" },
      { icon: "shield", titleBg: "Оригинални играчки", titleEn: "Genuine toys", textBg: "Само проверени марки и безопасни материали", textEn: "Only trusted brands and safe materials" },
      { icon: "heart", titleBg: "Лесно връщане", titleEn: "Easy returns", textBg: "14 дни за връщане без въпроси", textEn: "14-day no-questions returns" },
    ],
    teaserEnabled: true,
    teaserTextBg: "Момчетата от другата страна",
    teaserTextEn: "The boys are on the other side",
    teaserLink: "",
  },
  seo: {
    titleBg: "Maggie Joyland – Играчки за момичета",
    titleEn: "Maggie Joyland – Toys for girls",
    descriptionBg: "Кукли, плюшени играчки, бижута, комплекти за творчество и още играчки за момичета с бърза доставка в цяла България.",
    descriptionEn: "Dolls, plush toys, jewellery, craft kits and more toys for girls with fast delivery across Bulgaria.",
  },
  company: {
    legalName: "АРФА ЕС ЕООД",
    eik: "",
    vatNumber: "",
    registeredAddress: "",
    manager: "",
  },
  bonus: {
    enabled: true,
    perEuro: 1,
    redeemValue: 5,
    minRedeem: 100,
    titleBg: "Събирай сърчица с всяка покупка",
    titleEn: "Collect hearts with every purchase",
    textBg: "За всяко похарчено евро получаваш бонус точки, които се превръщат в отстъпка при следваща поръчка.",
    textEn: "Every euro you spend earns bonus points that turn into a discount on your next order.",
  },
  menu: {
    items: [
      { id: "categories", kind: "categories", labelBg: "Категории", labelEn: "Categories", href: "/shop", appearance: { ...DEFAULT_APPEARANCE, icon: "sparkles" }, columns: [], enabled: true },
      { id: "dolls", kind: "link", labelBg: "Кукли", labelEn: "Dolls", href: "/shop/kukli", appearance: DEFAULT_APPEARANCE, columns: [], enabled: true },
      { id: "beauty", kind: "link", labelBg: "Красота и бижута", labelEn: "Beauty & jewellery", href: "/shop/krasota-i-bizhuta", appearance: DEFAULT_APPEARANCE, columns: [], enabled: true },
      { id: "characters", kind: "link", labelBg: "Любими герои", labelEn: "Characters", href: "/characters", appearance: DEFAULT_APPEARANCE, columns: [], enabled: true },
      { id: "gifts", kind: "gifts", labelBg: "Идеи за подаръци", labelEn: "Gift ideas", href: "/gifts", appearance: { ...DEFAULT_APPEARANCE, icon: "gift" }, columns: [], enabled: true },
      { id: "new", kind: "link", labelBg: "Ново", labelEn: "New", href: "/new", appearance: DEFAULT_APPEARANCE, columns: [], enabled: true },
      { id: "blog", kind: "link", labelBg: "Блог", labelEn: "Blog", href: "/blog", appearance: DEFAULT_APPEARANCE, columns: [], enabled: true },
      { id: "sale", kind: "link", labelBg: "Намаления", labelEn: "Sale", href: "/sale", appearance: { style: "pill", color: "", color2: "", icon: "heart" }, columns: [], enabled: true },
    ],
  },
  gifts: {
    enabled: true,
    autoSuggest: true,
    menuLabelBg: "Идеи за подаръци",
    menuLabelEn: "Gift ideas",
    titleBg: "Идеи за подаръци",
    titleEn: "Gift ideas",
    textBg: "Подбрахме любимите подаръци на малките мечтателки – за рожден ден, имен ден или просто за усмивка.",
    textEn: "Our favourite gifts for little dreamers – for birthdays, name days or just for a smile.",
  },
  chat: {
    enabled: true,
    titleBg: "Пиши ни",
    titleEn: "Chat with us",
    greetingBg: "Здравей! 👋 С какво да помогнем? Питай за наличност, доставка или идея за подарък.",
    greetingEn: "Hi! 👋 How can we help? Ask about stock, delivery or a gift idea.",
    offlineTextBg: "В момента не сме на линия, но ще отговорим възможно най-скоро.",
    offlineTextEn: "We're not online right now, but we'll reply as soon as possible.",
    quickQuestionsBg: ["Имате ли този продукт в наличност?", "Кога ще пристигне поръчката ми?", "Помогнете ми да избера подарък", "Как да върна продукт?"],
    quickQuestionsEn: ["Is this product in stock?", "When will my order arrive?", "Help me choose a gift", "How do I return a product?"],
    askContact: true,
  },
};
