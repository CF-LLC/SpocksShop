import type { MockupType } from "@/lib/drop/mockups";
import { publicDesigns, type Design, type Garment } from "@/lib/drop/config";

/**
 * SEO gift landing pages (/gifts/<slug>). Copy is hand-written per page; designs are referenced by slug and
 * always filtered through publicDesigns() at render, so held designs can never appear even if listed here.
 */
export type GiftPage = {
  slug: string;
  title: string; // <title> (site template appends the shop name)
  h1: string;
  description: string; // meta description, ~150 chars
  intro: string;
  tips: string[];
  designs: string[] | "all";
  show: MockupType; // which mockup the grid shows
};

export const GIFT_PAGES: GiftPage[] = [
  {
    slug: "funny-gifts-for-him",
    title: "Funny Gifts for Him: Adult Humor Tees, Hoodies & Mugs",
    h1: "Funny gifts for him",
    description: "Funny gifts for him with adult humor: illustrated tees, hoodies, mugs, stickers and dad hats, printed to order. Tees from $28, mugs from $20.",
    intro: "For the guy who quotes bad movies, roasts his friends and still owns a shirt from 2009. These are original illustrated designs with jokes grown-ups actually laugh at, printed on the thing he'll use: a soft tee, a warm hoodie or a coffee mug.",
    tips: ["Know his size? A tee or hoodie is the easy win. Not sure? A mug or dad hat skips the guesswork.", "Pair a tee with a hoodie in the Tee + Hoodie bundle ($72, saves $4).", "Every item is printed to order, so allow about 2–7 business days plus shipping."],
    designs: "all",
    show: "tee",
  },
  {
    slug: "funny-gifts-for-her",
    title: "Funny Gifts for Her: Sarcastic Tees, Hoodies & Mugs",
    h1: "Funny gifts for her",
    description: "Funny gifts for her: sarcastic illustrated tees, cozy hoodies and mugs about dating, adulting and day drinking. Printed to order, mugs from $20.",
    intro: "For the friend who sends memes at 2 AM and has opinions about brunch. Ghosting, adulting, tequila regret: our original illustrations turn relatable chaos into something she can wear or sip from.",
    tips: ["Hoodies run unisex. If she likes it roomy, go one size up.", "Mugs come in 11oz ($20) and 15oz ($24) for the serious coffee drinker.", "Shopping for two? Two tees are $52 with the 2-tee deal."],
    designs: ["ghosted-by-a-ghost", "day-drinking", "adulting-1-star", "blame-the-tequila", "hungover-send-pizza", "meeting-email"],
    show: "tee",
  },
  {
    slug: "gag-gifts-for-adults",
    title: "Gag Gifts for Adults: Funny Shirts, Mugs & Stickers",
    h1: "Gag gifts for adults",
    description: "Gag gifts for adults that are actually wearable: original funny tees, hoodies, mugs, stickers and hats. Stickers from $7, tees from $28.",
    intro: "A gag gift should get a laugh when it's opened and still get used afterward. These designs are cheeky, a little rude and drawn by hand, so the joke lands without ending up in a junk drawer.",
    tips: ["Under $10: a kiss-cut sticker for a laptop, water bottle or toolbox.", "Under $25: a glossy mug, the gag gift they'll use every morning.", "Some designs contain mild profanity (starred out), so check the title before gifting to Grandma."],
    designs: "all",
    show: "tee",
  },
  {
    slug: "funny-drinking-gifts",
    title: "Funny Drinking Gifts: Day Drinking, Tequila & Hangover Shirts",
    h1: "Funny drinking gifts",
    description: "Funny drinking gifts for adults: day-drinking, tequila and hangover designs on tees, hoodies, mugs and hats. Great for birthdays and bachelor parties.",
    intro: "For the friend who's always first to the cooler and last to leave the patio. These designs celebrate the good decisions, the bad ones and the pizza that fixes them, on shirts and mugs for the morning after.",
    tips: ["Group trip or bachelor party? Mix designs and sizes; every two tees pair up for $52.", "A mug is the most honest hangover gift there is.", "Please drink responsibly. The flamingo float is just a drawing."],
    designs: ["day-drinking", "blame-the-tequila", "hungover-send-pizza"],
    show: "tee",
  },
  {
    slug: "funny-tequila-gifts",
    title: "Funny Tequila Gifts: Blame The Tequila Shirts & Mugs",
    h1: "Funny tequila gifts",
    description: "Funny tequila gifts: our Blame The Tequila design (a lime in a cowboy hat riding the bottle) on tees, hoodies, mugs, stickers and hats.",
    intro: "Every story that starts with \"one margarita\" ends here. Our Blame The Tequila illustration shows a lime in a cowboy hat riding the bottle while the salt shaker saw everything. Pair it with Day Drinking for the full patio set.",
    tips: ["Taco Tuesday regular? The tee and hoodie pair up for $72 in the bundle.", "The sticker suits a cooler or a flask.", "Tees and hoodies are printed in Black and Navy, shown in the photos."],
    designs: ["blame-the-tequila", "day-drinking"],
    show: "tee",
  },
  {
    slug: "funny-white-elephant-gifts",
    title: "Funny White Elephant Gifts Under $30 for Adults",
    h1: "Funny white elephant gifts",
    description: "Funny white elephant gifts for adults under $30: illustrated mugs from $20, stickers from $7, tees and dad hats at $28. Gifts that get stolen.",
    intro: "The best white elephant gift is the one that gets stolen twice. A funny mug or dad hat fits most $20–$30 limits, works for any size and starts an argument at the table, in a good way.",
    tips: ["Mugs and hats are one-size, so they're the safest pick for a swap.", "Order early: everything is printed to order (about 2–7 business days plus shipping).", "Office swap? Stick to the coworker-friendly designs below."],
    designs: "all",
    show: "mug",
  },
  {
    slug: "funny-coworker-gifts",
    title: "Funny Coworker Gifts: Office Humor Mugs & Shirts",
    h1: "Funny gifts for coworkers",
    description: "Funny coworker gifts with office humor: \"This Meeting Could've Been An Email\" and more, on mugs, tees and stickers. Mugs from $20.",
    intro: "For the teammate who survives on coffee and calendar invites. These office-humor designs say what everyone is thinking in the 4 PM sync, on a mug that lives on their desk.",
    tips: ["A mug is the classic desk gift and needs no size.", "A sticker for the laptop lid costs $7 to $9.", "Two designs include a starred-out swear word, so read the room before your next team gift exchange."],
    designs: ["meeting-email", "screwed-at-work", "adulting-1-star"],
    show: "mug",
  },
  {
    slug: "funny-mugs-for-adults",
    title: "Funny Mugs for Adults: Illustrated Coffee Mugs",
    h1: "Funny mugs for adults",
    description: "Funny coffee mugs for adults with original illustrations. Glossy white 11oz ($20) or 15oz ($24) mugs, printed to order.",
    intro: "Coffee should come with a laugh. Each mug is glossy white with one of our original illustrations, printed on the side that faces out when you hold it in your right hand.",
    tips: ["11oz is a standard cup. 15oz is for people who don't want to get up for a refill.", "Mugs ship at $7.99 flat per order.", "Want a matching set? Each design is also on tees and hoodies."],
    designs: "all",
    show: "mug",
  },
  {
    slug: "funny-hangover-gifts",
    title: "Funny Hangover Gifts: Send Pizza & Day Drinking Shirts",
    h1: "Funny hangover gifts",
    description: "Funny hangover gifts: Hungover As F*ck Send Pizza, Day Drinking and Blame The Tequila designs on hoodies, tees and mugs.",
    intro: "For the morning after the night before. A raccoon in last night's party hat knows that pizza is medicine, and a hoodie is the only acceptable outfit until noon.",
    tips: ["The hoodie is the comfort pick. Pair it with a tee for $72 in the bundle.", "A mug for the recovery coffee starts at $20.", "Contains a starred-out swear word in the title."],
    designs: ["hungover-send-pizza", "day-drinking", "blame-the-tequila"],
    show: "hoodie",
  },
  {
    slug: "funny-dating-gifts",
    title: "Funny Gifts for Single Friends: Got Ghosted Shirts & Mugs",
    h1: "Funny gifts for single friends",
    description: "Funny gifts for single friends: Got Ghosted By A Ghost, Adulting 1 Star and more original designs on tees, hoodies and mugs.",
    intro: "For the friend with dating-app stories you couldn't make up. Our Got Ghosted By A Ghost design (a candlelit table for two, and the chair is empty) turns the worst date into the best inside joke.",
    tips: ["Great for a Galentine's or breakup-recovery gift.", "Two tees are $52, one for them and one for the group chat's best friend.", "Not sure of the size? Choose a mug or a sticker."],
    designs: ["ghosted-by-a-ghost", "adulting-1-star", "day-drinking"],
    show: "tee",
  },
];

export const giftPage = (slug: string) => GIFT_PAGES.find((p) => p.slug === slug) ?? null;

/** Public designs only (held ones filtered out at call time), in the page's order; with `garment`, only designs sold on it. */
export function designsFor(slugs: string[] | "all", env: Record<string, string | undefined> = process.env, garment?: Garment): Design[] {
  const pub = publicDesigns(env).filter((d) => !garment || d.garments.includes(garment));
  return slugs === "all" ? pub : slugs.map((s) => pub.find((d) => d.slug === s)).filter((d): d is Design => d !== undefined);
}
