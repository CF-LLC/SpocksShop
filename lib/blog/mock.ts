import { isDuplicateTopic, topicKey } from "./rules";

/** Deterministic draft for AI_PROVIDER=mock (local dev, tests, screenshots). Never used in production. */
const TOPICS = [
  { kind: "buying_guide", keyword: "space gifts for adults", title: "Space Gifts for Adults: A Practical Buying Guide", lead: "Shopping for someone who looks up at the night sky a lot is easier than it seems. The trick is matching the gift to how they actually enjoy space: reading about it, displaying it, or using it every day." },
  { kind: "how_to", keyword: "how to decorate a space themed room", title: "How to Decorate a Space Themed Room Without Overdoing It", lead: "A space themed room works best when it feels calm, not like a planetarium gift shop. A few deliberate pieces, a consistent color palette and good lighting do most of the work." },
  { kind: "explainer", keyword: "what is a light year explained", title: "What Is a Light Year? A Plain-English Explainer", lead: "A light year sounds like a unit of time, but it measures distance: how far light travels in one year, roughly 9.46 trillion kilometers. Once that clicks, a lot of astronomy news gets easier to follow." },
  { kind: "buying_guide", keyword: "space themed kitchen gifts", title: "Space Themed Kitchen Gifts That Get Used Every Day", lead: "Kitchen gifts are a safe bet because they get used. A space themed mug or utensil keeps the theme visible without taking over a shelf." },
] as const;

const TIPS = [
  "Start with how the person spends their time. Someone who reads before bed will get more out of a well-chosen book than a display piece, while someone with a desk setup they care about will notice a small, good-looking object every day.",
  "Check the product page carefully before buying. Look at the listed dimensions, materials and what is included in the box, because photos can make items look larger or smaller than they are.",
  "Think about where the item will live. A shelf piece needs shelf space, a wall piece needs a wall, and a kitchen item needs to survive the dishwasher, so look for care instructions on the listing.",
  "Keep the theme consistent. Deep blues, blacks and a single accent color read as space without spelling it out, and they mix well with furniture people already own.",
  "If you are unsure about size or fit, choose something with a simple return policy and check the seller details on the listing.",
  "Pair a practical item with a small personal note about why you chose it. That turns an ordinary gift into one people remember.",
];

export function mockBlogPost(picks: { id: string; title: string }[], existingKeys: string[]) {
  const t = TOPICS.find((x) => !isDuplicateTopic(topicKey(x.keyword), existingKeys)) ?? TOPICS[0];
  const chosen = picks.slice(0, 4);
  const parts: string[] = [t.lead, "", "This guide explains what to look for, highlights a few picks from our shop, and ends with quick answers to common questions.", "", "## What to look for"];
  for (const tip of TIPS) parts.push("", tip);
  parts.push("", "## Our picks");
  chosen.forEach((p, i) => {
    parts.push(
      "",
      `### ${i + 1}. ${p.title}`,
      "",
      `This one fits the theme going by its name: ${p.title}. Before choosing it, read the full product page for the exact size, materials and what comes in the box, since those details matter more than photos. It suits someone who wants the space theme in something they will see often. It is probably not the right pick if the person already has a lot of similar items or prefers a minimal look.`,
      "",
      `[[pick:${p.id}]]`,
    );
  });
  parts.push(
    "", "## How to choose between them",
    "", "If the person likes to learn, lean toward reading material or anything that explains something. If they like to display things, choose a piece that works on a shelf or desk. If they prefer practical gifts, choose something they will use every day, like kitchen or desk items.",
    "", "Whatever you choose, the best space gifts connect to something real: a favorite planet, a mission they followed, or the simple habit of looking up on a clear night. Mentioning that connection in a card makes the gift feel considered.",
    "", "## A little space context",
    "", "Light from the Sun takes a little over eight minutes to reach Earth, and the nearest star system beyond it, Alpha Centauri, is about four light years away. Facts like these are a nice conversation starter to include with a space themed gift.",
    "", "The Moon is the brightest object in the night sky after the Sun, and it always shows Earth the same face because it rotates once for every orbit. Planets such as Venus and Jupiter are often visible to the naked eye and are easy targets for a first night of stargazing.",
    "", "## Frequently asked questions",
    "", "### Are space gifts only for science fans?",
    "", "No. Many space themed items are simply nice design objects. The theme works for anyone who likes the look of a night sky.",
    "", "### How do I know an item is the right size?",
    "", "Check the dimensions on the product page and compare them with something you already own. Photos alone can be misleading.",
    "", "### Can I return an item if it is not right?",
    "", "Return options depend on the seller, so read the return details on the product page before you buy.",
    "", "## Final thoughts",
    "", "Good space gifts are less about the theme and more about fit: how the person spends their time and where the item will live. Start there, read each product page closely, and choose the pick that matches the person rather than the one with the most stars on it.".replace(" with the most stars on it", " that looks flashiest"),
  );
  let body = parts.join("\n");
  // Pad with a general tips section so the mock always clears the 900-word minimum.
  let i = 0;
  while (body.split(/\s+/).length < 950 && i < 12) body += `\n\n${TIPS[i++ % TIPS.length]}`;
  return { kind: t.kind, title: t.title, target_keyword: t.keyword, description: `${t.title.split(":")[0]}: what to look for, a few honest picks from our shop, and quick answers to common questions.`.slice(0, 160), body_markdown: body };
}
