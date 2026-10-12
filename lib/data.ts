import {
  Category,
  HuntEntry,
  Product,
  ProductCondition,
  productConditions,
} from "@/lib/types";

export const BRAND = {
  name: "Spock's Resale Shop",
  slogan: "Live Long and Prosper",
  description:
    "A curated ecommerce resale shop for unique secondhand finds sourced from outlets, thrift stores, flea markets, estate sales, and clearance bins.",
};

export const categories: Category[] = [
  {
    slug: "clothing",
    name: "Clothing",
    description: "Fresh fits, vintage cuts, and wardrobe gems with character.",
  },
  {
    slug: "shoes",
    name: "Shoes",
    description: "From street-ready sneakers to classy formal rescues.",
  },
  {
    slug: "electronics",
    name: "Electronics",
    description: "Reliable tech with more life left in the circuit.",
  },
  {
    slug: "collectibles",
    name: "Collectibles",
    description: "Rare finds and fandom treasures worth displaying.",
  },
  {
    slug: "vintage",
    name: "Vintage",
    description: "Retro objects with stories, style, and soul.",
  },
  {
    slug: "home",
    name: "Home",
    description: "Useful and beautiful pieces for everyday living spaces.",
  },
  {
    slug: "gaming",
    name: "Gaming",
    description: "Consoles, accessories, and nostalgia-fueled fun.",
  },
  {
    slug: "miscellaneous",
    name: "Miscellaneous",
    description: "Unexpected oddities that make the hunt exciting.",
  },
];

/**
 * Real archival photography sourced from Unsplash. `plus` denotes photos
 * served from the plus.unsplash.com CDN (premium contributor pool) versus
 * the standard images.unsplash.com pool — both are used at preview
 * resolution via query params, never full-resolution downloads.
 */
type ArchivePhoto = { slug: string; plus?: boolean };

function unsplashSrc(photo: ArchivePhoto, w: number, h: number) {
  const host = photo.plus
    ? "https://plus.unsplash.com/premium_photo-"
    : "https://images.unsplash.com/photo-";
  return `${host}${photo.slug}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

function buildImages(title: string, subtitle: string, photos: ArchivePhoto[]) {
  return photos.map((photo, index) => ({
    id: `${title.toLowerCase().replaceAll(" ", "-")}-${index + 1}`,
    src: unsplashSrc(photo, 1200, 1000),
    alt: `${title} — ${subtitle}`,
    width: 1200,
    height: 1000,
  }));
}

const NOW = "2026-08-10T18:45:00.000Z";

export const products: Product[] = [
  {
    id: "prod-1",
    sku: "SRS-CL-2418",
    slug: "pendleton-wool-overcoat-charcoal",
    title: "Pendleton Wool Overcoat",
    description:
      "Structured charcoal wool overcoat sourced from an estate sale. Fully lined, warm, and tailored enough for formal nights while still pairing with denim.",
    category: "clothing",
    subcategory: "Outerwear",
    brand: "Pendleton",
    condition: "Excellent",
    conditionNotes: "Minimal sleeve wear and no stains. Inner label is intact.",
    price: 92,
    originalPrice: 210,
    purchaseCost: 28,
    quantity: 1,
    images: buildImages("Pendleton Wool Overcoat", "Estate Sale Find", [
      { slug: "1544022613-e87ca75a784a" },
      { slug: "1551028719-00167b16eac5" },
    ]),
    dimensions: { lengthIn: 44, widthIn: 22, heightIn: 2 },
    weightLb: 3.8,
    color: "Charcoal",
    size: "Men's L",
    tags: ["wool", "winter", "classic fit", "estate sale"],
    dateAcquired: "2026-07-31",
    dateListed: "2026-08-09",
    featured: true,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-pendleton-overcoat",
        listingUrl: "https://spockshop.com/shop/pendleton-wool-overcoat-charcoal",
        status: "active",
        listedAt: "2026-08-09T09:40:00.000Z",
        lastSyncedAt: NOW,
      },
      {
        channel: "eBay",
        listingId: "eb-54392011",
        listingUrl: "https://www.ebay.com/itm/54392011",
        status: "active",
        listedAt: "2026-08-09T10:02:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-09T09:38:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-2",
    sku: "SRS-SH-1902",
    slug: "new-balance-574-sneakers-navy",
    title: "New Balance 574 Sneakers",
    description:
      "Classic 574 runners with excellent cushion and clean suede overlays. Sourced from a local outlet closeout shelf.",
    category: "shoes",
    subcategory: "Sneakers",
    brand: "New Balance",
    condition: "Like New",
    conditionNotes: "Outsoles show very light use; original insoles included.",
    price: 58,
    originalPrice: 95,
    purchaseCost: 24,
    quantity: 1,
    images: buildImages("New Balance 574", "Outlet Closeout", [
      { slug: "1680204101489-2c1319c872b2" },
      { slug: "1595950653106-6c9ebd614d3a" },
    ]),
    dimensions: { lengthIn: 13, widthIn: 8, heightIn: 5 },
    weightLb: 2.2,
    color: "Navy / Gray",
    size: "Men's 10.5",
    tags: ["sneakers", "comfort", "everyday"],
    dateAcquired: "2026-08-03",
    dateListed: "2026-08-10",
    featured: true,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-nb-574",
        listingUrl: "https://spockshop.com/shop/new-balance-574-sneakers-navy",
        status: "active",
        listedAt: "2026-08-10T08:22:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-10T08:18:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-3",
    sku: "SRS-EL-6720",
    slug: "sony-cassette-boombox-cfd-s70",
    title: "Sony Cassette Boombox CFD-S70",
    description:
      "Portable cassette and CD boombox tested for playback and radio reception. Great garage, workshop, or nostalgia-room audio unit.",
    category: "electronics",
    subcategory: "Audio",
    brand: "Sony",
    condition: "Good",
    conditionNotes: "Cosmetic scuffs on top panel; all primary functions tested.",
    price: 46,
    originalPrice: 99,
    purchaseCost: 16,
    quantity: 1,
    images: buildImages("Sony CFD-S70 Boombox", "Thrift Audio Find", [
      { slug: "1682125768864-c80b650614f3", plus: true },
    ]),
    dimensions: { lengthIn: 12, widthIn: 7, heightIn: 5 },
    weightLb: 4.1,
    color: "Black",
    size: "N/A",
    tags: ["audio", "cassette", "boombox", "tested"],
    dateAcquired: "2026-08-01",
    dateListed: "2026-08-06",
    featured: true,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-sony-cfd-s70",
        listingUrl: "https://spockshop.com/shop/sony-cassette-boombox-cfd-s70",
        status: "active",
        listedAt: "2026-08-06T11:20:00.000Z",
        lastSyncedAt: NOW,
      },
      {
        channel: "Facebook Marketplace",
        listingId: "fb-770112",
        listingUrl: "https://facebook.com/marketplace/item/770112",
        status: "active",
        listedAt: "2026-08-06T12:00:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-06T11:18:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-4",
    sku: "SRS-CO-3311",
    slug: "hot-wheels-display-case-vintage",
    title: "Vintage Hot Wheels Display Case",
    description:
      "Carrying case and wall-display style collector piece with rotating trays. A fun collectible from a weekend flea market run.",
    category: "collectibles",
    subcategory: "Toy Collectibles",
    brand: "Mattel",
    condition: "Good",
    conditionNotes: "Corner wear and one hinge repaired; opens and closes securely.",
    price: 42,
    originalPrice: 88,
    purchaseCost: 12,
    quantity: 1,
    images: buildImages("Hot Wheels Display Case", "Flea Market Rescue", [
      { slug: "1680129939536-ae71c691c590", plus: true },
    ]),
    dimensions: { lengthIn: 16, widthIn: 12, heightIn: 4 },
    weightLb: 2.9,
    color: "Orange / Black",
    size: "N/A",
    tags: ["collectible", "display", "vintage toy"],
    dateAcquired: "2026-08-02",
    dateListed: "2026-08-07",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-hot-wheels-case",
        listingUrl: "https://spockshop.com/shop/hot-wheels-display-case-vintage",
        status: "active",
        listedAt: "2026-08-07T14:12:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-07T14:10:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-5",
    sku: "SRS-VI-9042",
    slug: "midcentury-brass-desk-lamp-adjustable",
    title: "Midcentury Brass Desk Lamp",
    description:
      "Solid vintage desk lamp with adjustable neck, warm brass finish, and rewired switch. Adds instant character to any office.",
    category: "vintage",
    subcategory: "Lighting",
    brand: "Unbranded",
    condition: "Excellent",
    conditionNotes: "Rewired and cleaned; slight patina preserved intentionally.",
    price: 76,
    originalPrice: 165,
    purchaseCost: 26,
    quantity: 1,
    images: buildImages("Midcentury Brass Lamp", "Estate Lighting", [
      { slug: "1775811035108-658b4b101cdb" },
    ]),
    dimensions: { lengthIn: 9, widthIn: 9, heightIn: 18 },
    weightLb: 5.4,
    color: "Brass",
    size: "N/A",
    tags: ["vintage", "lighting", "midcentury"],
    dateAcquired: "2026-07-28",
    dateListed: "2026-08-04",
    featured: true,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-midcentury-brass-lamp",
        listingUrl:
          "https://spockshop.com/shop/midcentury-brass-desk-lamp-adjustable",
        status: "active",
        listedAt: "2026-08-04T16:08:00.000Z",
        lastSyncedAt: NOW,
      },
      {
        channel: "Mercari",
        listingId: "mc-1193822",
        listingUrl: "https://www.mercari.com/us/item/mc-1193822/",
        status: "active",
        listedAt: "2026-08-04T16:33:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-04T16:05:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-6",
    sku: "SRS-HO-5107",
    slug: "le-creuset-ceramic-mug-set-blue",
    title: "Le Creuset Ceramic Mug Set",
    description:
      "Set of four heavyweight ceramic mugs in deep marine blue. Found in a clearance store with unopened inner packaging.",
    category: "home",
    subcategory: "Kitchenware",
    brand: "Le Creuset",
    condition: "New",
    conditionNotes: "Open-box inventory; no use marks, no chips, original stickers.",
    price: 52,
    originalPrice: 88,
    purchaseCost: 21,
    quantity: 2,
    images: buildImages("Le Creuset Mug Set", "Clearance Shelf", [
      { slug: "1668046490161-f08d1280f10c", plus: true },
    ]),
    dimensions: { lengthIn: 12, widthIn: 8, heightIn: 5 },
    weightLb: 4.8,
    color: "Marine Blue",
    size: "14 oz each",
    tags: ["kitchen", "ceramic", "giftable"],
    dateAcquired: "2026-08-05",
    dateListed: "2026-08-10",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-le-creuset-mugs",
        listingUrl: "https://spockshop.com/shop/le-creuset-ceramic-mug-set-blue",
        status: "active",
        listedAt: "2026-08-10T10:40:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-10T10:36:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-7",
    sku: "SRS-GA-7721",
    slug: "nintendo-switch-pro-controller",
    title: "Nintendo Switch Pro Controller",
    description:
      "Official wireless pro controller with responsive sticks and strong battery health. Ideal replacement or second setup.",
    category: "gaming",
    subcategory: "Controllers",
    brand: "Nintendo",
    condition: "Like New",
    conditionNotes: "Button click and stick test passed; includes charging cable.",
    price: 45,
    originalPrice: 69,
    purchaseCost: 23,
    quantity: 1,
    images: buildImages("Switch Pro Controller", "Outlet Electronics", [
      { slug: "1612036781124-847f8939b154" },
    ]),
    dimensions: { lengthIn: 7, widthIn: 5, heightIn: 3 },
    weightLb: 1,
    color: "Black",
    size: "N/A",
    tags: ["gaming", "controller", "wireless"],
    dateAcquired: "2026-08-04",
    dateListed: "2026-08-08",
    featured: true,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-switch-pro-controller",
        listingUrl: "https://spockshop.com/shop/nintendo-switch-pro-controller",
        status: "active",
        listedAt: "2026-08-08T13:20:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-08T13:16:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-8",
    sku: "SRS-MI-2833",
    slug: "timex-ironman-digital-watch",
    title: "Timex Ironman Digital Watch",
    description:
      "Everyday retro digital watch with classic 90s sport profile and indiglo backlight still fully functional.",
    category: "miscellaneous",
    subcategory: "Accessories",
    brand: "Timex",
    condition: "Good",
    conditionNotes: "Light case scratches and fresh battery installed.",
    price: 24,
    originalPrice: 49,
    purchaseCost: 8,
    quantity: 1,
    images: buildImages("Timex Ironman Watch", "Thrift Accessory", [
      { slug: "1543956872-37cfc5474a71" },
    ]),
    dimensions: { lengthIn: 9, widthIn: 2, heightIn: 0.6 },
    weightLb: 0.25,
    color: "Black / Silver",
    size: "One Size",
    tags: ["watch", "retro", "accessory"],
    dateAcquired: "2026-08-03",
    dateListed: "2026-08-06",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-timex-ironman",
        listingUrl: "https://spockshop.com/shop/timex-ironman-digital-watch",
        status: "active",
        listedAt: "2026-08-06T09:18:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-06T09:12:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-9",
    sku: "SRS-CL-4401",
    slug: "lee-rider-denim-jacket-vintage",
    title: "Lee Rider Denim Jacket",
    description:
      "Vintage denim trucker jacket with ideal fade and classic structure. A staple pulled from a donation-center rack.",
    category: "clothing",
    subcategory: "Jackets",
    brand: "Lee",
    condition: "Good",
    conditionNotes: "Distressed fade and light cuff wear consistent with age.",
    price: 39,
    originalPrice: 98,
    purchaseCost: 11,
    quantity: 1,
    images: buildImages("Lee Rider Denim", "Donation Rack Pull", [
      { slug: "1698260795242-0a3eb6e150e7", plus: true },
    ]),
    dimensions: { lengthIn: 27, widthIn: 22, heightIn: 1.5 },
    weightLb: 2.5,
    color: "Stonewashed Blue",
    size: "Men's M",
    tags: ["denim", "vintage", "jacket"],
    dateAcquired: "2026-07-30",
    dateListed: "2026-08-05",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-lee-rider-jacket",
        listingUrl: "https://spockshop.com/shop/lee-rider-denim-jacket-vintage",
        status: "active",
        listedAt: "2026-08-05T15:00:00.000Z",
        lastSyncedAt: NOW,
      },
      {
        channel: "Poshmark",
        listingId: "pm-927100",
        listingUrl: "https://poshmark.com/listing/pm-927100",
        status: "active",
        listedAt: "2026-08-05T15:15:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-05T14:56:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-10",
    sku: "SRS-SH-8822",
    slug: "cole-haan-loafers-brown-leather",
    title: "Cole Haan Leather Loafers",
    description:
      "Polished brown loafers with padded footbed and clean leather grain. Office-ready with minimal prep needed.",
    category: "shoes",
    subcategory: "Loafers",
    brand: "Cole Haan",
    condition: "Excellent",
    conditionNotes: "Recently conditioned leather; heel drag is very minor.",
    price: 54,
    originalPrice: 140,
    purchaseCost: 19,
    quantity: 1,
    images: buildImages("Cole Haan Loafers", "Estate Dress Wear", [
      { slug: "1670984281009-863453504c52", plus: true },
    ]),
    dimensions: { lengthIn: 13, widthIn: 8, heightIn: 5 },
    weightLb: 2.6,
    color: "Brown",
    size: "Men's 10",
    tags: ["leather", "dress shoes", "office"],
    dateAcquired: "2026-07-29",
    dateListed: "2026-08-03",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-cole-haan-loafers",
        listingUrl:
          "https://spockshop.com/shop/cole-haan-loafers-brown-leather",
        status: "active",
        listedAt: "2026-08-03T12:08:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-03T12:03:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-11",
    sku: "SRS-EL-1205",
    slug: "yamaha-receiver-rx-v371",
    title: "Yamaha RX-V371 Receiver",
    description:
      "5.1 home receiver with strong output and HDMI switching. Great starter unit for budget home theater builds.",
    category: "electronics",
    subcategory: "Home Audio",
    brand: "Yamaha",
    condition: "Fair",
    conditionNotes: "Front panel cosmetic wear; remote missing but tested with universal remote.",
    price: 68,
    originalPrice: 240,
    purchaseCost: 20,
    quantity: 1,
    images: buildImages("Yamaha RX-V371", "Estate Audio Rack", [
      { slug: "1723906830797-9fad4e956c25", plus: true },
    ]),
    dimensions: { lengthIn: 17, widthIn: 14, heightIn: 6.5 },
    weightLb: 16.2,
    color: "Black",
    size: "N/A",
    tags: ["receiver", "home theater", "audio"],
    dateAcquired: "2026-07-26",
    dateListed: "2026-08-02",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-yamaha-rx-v371",
        listingUrl: "https://spockshop.com/shop/yamaha-receiver-rx-v371",
        status: "active",
        listedAt: "2026-08-02T11:50:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-02T11:42:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-12",
    sku: "SRS-CO-9980",
    slug: "atari-2600-joystick-pair-repair",
    title: "Atari 2600 Joystick Pair",
    description:
      "Two original joysticks sold as a repair set for restoration projects or display. Authentic cords and shells included.",
    category: "collectibles",
    subcategory: "Retro Gaming",
    brand: "Atari",
    condition: "For Parts/Repair",
    conditionNotes:
      "One stick has intermittent directional response and both need full internal cleaning.",
    price: 19,
    purchaseCost: 6,
    quantity: 1,
    images: buildImages("Atari Joystick Pair", "Repair Bin Find", [
      { slug: "1677422889741-0e01bf6d92cd", plus: true },
    ]),
    dimensions: { lengthIn: 6, widthIn: 4, heightIn: 3 },
    weightLb: 1.4,
    color: "Black",
    size: "N/A",
    tags: ["atari", "parts", "repair", "retro gaming"],
    dateAcquired: "2026-08-06",
    dateListed: "2026-08-10",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-atari-joystick-pair",
        listingUrl: "https://spockshop.com/shop/atari-2600-joystick-pair-repair",
        status: "active",
        listedAt: "2026-08-10T14:00:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-10T13:50:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-13",
    sku: "SRS-HO-2164",
    slug: "walnut-floating-shelves-set",
    title: "Walnut Floating Shelves Set",
    description:
      "Set of two walnut veneer floating shelves with hidden mounting hardware included. Clean contemporary look with vintage warmth.",
    category: "home",
    subcategory: "Storage",
    brand: "Threshold",
    condition: "Excellent",
    conditionNotes: "One shelf has a tiny back-edge nick hidden after mounting.",
    price: 47,
    originalPrice: 110,
    purchaseCost: 17,
    quantity: 1,
    images: buildImages("Walnut Shelf Set", "Clearance Home Find", [
      { slug: "1683134107399-31d2d166d3ee", plus: true },
    ]),
    dimensions: { lengthIn: 24, widthIn: 8, heightIn: 1.5 },
    weightLb: 7.2,
    color: "Walnut",
    size: "24 in",
    tags: ["home decor", "storage", "shelves"],
    dateAcquired: "2026-08-02",
    dateListed: "2026-08-08",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-walnut-shelf-set",
        listingUrl: "https://spockshop.com/shop/walnut-floating-shelves-set",
        status: "active",
        listedAt: "2026-08-08T09:48:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-08T09:44:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "prod-14",
    sku: "SRS-VI-6512",
    slug: "pyrex-butterprint-mixing-bowl",
    title: "Pyrex Butterprint Mixing Bowl",
    description:
      "Iconic turquoise butterprint Pyrex bowl. A standout vintage kitchen collectible with practical everyday utility.",
    category: "vintage",
    subcategory: "Kitchen Collectibles",
    brand: "Pyrex",
    condition: "Good",
    conditionNotes: "Pattern remains bright; minor utensil marks on inner base.",
    price: 33,
    originalPrice: 75,
    purchaseCost: 10,
    quantity: 1,
    images: buildImages("Pyrex Butterprint Bowl", "Estate Kitchen Lot", [
      { slug: "1714841548008-6e488c6b4016", plus: true },
    ]),
    dimensions: { lengthIn: 8, widthIn: 8, heightIn: 4.5 },
    weightLb: 2.1,
    color: "Turquoise / White",
    size: "2.5 qt",
    tags: ["pyrex", "vintage", "kitchen"],
    dateAcquired: "2026-08-01",
    dateListed: "2026-08-07",
    featured: false,
    status: "listed",
    marketplaceListing: [
      {
        channel: "Website",
        listingId: "web-pyrex-butterprint",
        listingUrl: "https://spockshop.com/shop/pyrex-butterprint-mixing-bowl",
        status: "active",
        listedAt: "2026-08-07T18:30:00.000Z",
        lastSyncedAt: NOW,
      },
    ],
    createdAt: "2026-08-07T18:25:00.000Z",
    updatedAt: NOW,
  },
];

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/hunt", label: "The Hunt" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

export const policies = [
  { href: "/faq#shipping", label: "Shipping Policy" },
  { href: "/faq#returns", label: "Returns Policy" },
  { href: "/faq#privacy", label: "Privacy Policy" },
];

export const shopProducts = products.filter(
  (product) => product.status === "listed" && product.quantity > 0,
);

export const justDiscovered = [...shopProducts]
  .sort((a, b) => b.dateListed.localeCompare(a.dateListed))
  .slice(0, 6);

export const featuredProducts = shopProducts.filter((product) => product.featured);

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(productId: string) {
  return products.find((product) => product.id === productId);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function isJustFound(dateListed: string) {
  const listedTime = new Date(dateListed).getTime();
  const now = new Date("2026-08-10T23:59:59.000Z").getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return now - listedTime <= dayMs * 7;
}

export function isOnSale(product: Product) {
  return Boolean(product.originalPrice && product.originalPrice > product.price);
}

export function getRelatedProducts(product: Product, limit = 4) {
  return shopProducts
    .filter(
      (item) =>
        item.id !== product.id &&
        (item.subcategory === product.subcategory || item.category === product.category),
    )
    .slice(0, limit);
}

export const conditionFilterOptions: ProductCondition[] = [...productConditions];

export const showHuntSensitiveMetrics =
  process.env.NEXT_PUBLIC_SHOW_HUNT_INTERNALS === "true";

function pickHuntPhotos(productId: string) {
  const product = products.find((item) => item.id === productId);
  if (!product) return [];
  return product.images;
}

export const huntEntries: HuntEntry[] = [
  {
    id: "hunt-1",
    productId: "prod-12",
    whereDiscovered: "Saturday booth row at a Northwest Arkansas flea market",
    discoveryDate: "2026-08-06",
    purchasePrice: 6,
    story:
      "I spotted it buried underneath a box of tangled charging cables and older remotes. The seller thought both sticks were dead, but the shells were original and clean enough for a full restore candidate.",
    result:
      "Cleaned, tested, photographed, and listed as a restoration-ready pair for collectors.",
    photos: pickHuntPhotos("prod-12"),
    finalResalePrice: 19,
    profit: 13,
    status: "Available",
    createdAt: "2026-08-10T14:01:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "hunt-2",
    productId: "prod-5",
    whereDiscovered: "Private estate sale in Hyde Park",
    discoveryDate: "2026-07-28",
    purchasePrice: 26,
    story:
      "The lamp was tucked behind stacks of old magazines in a study. The brass had great bones and the neck mechanism still locked firmly in place.",
    result:
      "Rewired, polished, and photographed in natural light. It quickly became one of our featured listings.",
    photos: pickHuntPhotos("prod-5"),
    finalResalePrice: 76,
    profit: 50,
    status: "Available",
    createdAt: "2026-08-04T16:08:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "hunt-3",
    productId: "prod-1",
    whereDiscovered: "Neighborhood estate liquidation on a rainy morning",
    discoveryDate: "2026-07-31",
    purchasePrice: 28,
    story:
      "The overcoat was hanging in a packed hallway closet between old uniforms. The cut and wool quality stood out immediately.",
    result:
      "Steam-cleaned, lint-rolled, measured, and posted as a premium outerwear find.",
    photos: pickHuntPhotos("prod-1"),
    finalResalePrice: 92,
    profit: 64,
    status: "Available",
    createdAt: "2026-08-09T09:40:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "hunt-4",
    productId: "prod-3",
    whereDiscovered: "Donation thrift electronics shelf",
    discoveryDate: "2026-08-01",
    purchasePrice: 16,
    story:
      "Found the boombox half-hidden behind DVD players with a missing price sticker. After a quick battery test in-store, radio and cassette drive both spun up.",
    result:
      "Deep-cleaned controls, confirmed tape + CD playback, and listed as a tested nostalgia audio piece.",
    photos: pickHuntPhotos("prod-3"),
    finalResalePrice: 46,
    profit: 30,
    status: "Sold",
    createdAt: "2026-08-06T11:21:00.000Z",
    updatedAt: NOW,
  },
  {
    id: "hunt-5",
    productId: "prod-6",
    whereDiscovered: "Outlet clearance end-cap",
    discoveryDate: "2026-08-05",
    purchasePrice: 21,
    story:
      "This set was misplaced on an overstock shelf behind holiday inventory. Box was open but every mug was untouched and stickered.",
    result:
      "Confirmed condition, staged with kitchen props, and listed as a gift-ready home find.",
    photos: pickHuntPhotos("prod-6"),
    finalResalePrice: 52,
    profit: 31,
    status: "Available",
    createdAt: "2026-08-10T10:41:00.000Z",
    updatedAt: NOW,
  },
];
