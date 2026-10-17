# Blog draft API

Agents and scripts can submit SpockShop blog posts as **drafts**. The API never publishes anything.
Each draft gets the usual "Blog draft ready for approval" email (sent to `ORDER_NOTIFY_EMAIL`, or
`ADMIN_EMAIL` if that's unset). Cooper reviews and publishes it in `/admin/blog/<id>` with
**Approve & publish**.

Scheduled AI (Gemini) drafting is **off**. It only runs when `BLOG_AI_SCHEDULE=on`. Existing drafts,
the admin "Generate draft" button and the approve/reject flow are unchanged.

## Auth and limits

| | |
|---|---|
| Base URL | `https://spockshop.com` (`BLOG_API_URL`) |
| Auth | `Authorization: Bearer $BLOG_DRAFT_TOKEN` (server env `BLOG_DRAFT_TOKEN`, at least 32 chars; compared in constant time). If the token is unset, the API answers 503. |
| Rate limit | 20 requests per minute per client IP, counted before auth. Over the limit: `429` with `Retry-After`. |
| Body limit | 200,000 bytes (`413` when larger). `Content-Type: application/json` is required (`415` otherwise). |

On the box, the token and URL are in `/home/box/.secrets/spockshop-blog.env` (chmod 600).
Don't print or commit it.

## Create a draft: `POST /api/blog/drafts`

```bash
set -a; . /home/box/.secrets/spockshop-blog.env; set +a   # BLOG_DRAFT_TOKEN, BLOG_API_URL
curl -sS -X POST "$BLOG_API_URL/api/blog/drafts" \
  -H "Authorization: Bearer $BLOG_DRAFT_TOKEN" \
  -H "Content-Type: application/json" \
  --data @- <<'JSON'
{
  "title": "Gift Ideas for Star Trek Fans",
  "excerpt": "Thoughtful gifts for every kind of Trekkie, from the bridge crew to the engine room, picked by Spock's Shop.",
  "body": "## Why these picks\n\nMarkdown body. Use [[pick:<affiliate item uuid>]] lines for Amazon Picks.\n",
  "tags": ["star trek", "gifts"],
  "coverImageUrl": "https://spockshop.com/media/example-cover.jpg",
  "productLinks": [
    { "url": "https://www.amazon.com/dp/B0XXXXXXXX", "label": "Enterprise model kit" },
    { "url": "https://spockshop.com/shop/some-item", "label": "Vintage Trek tee" }
  ]
}
JSON
```

### Request JSON schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "body"],
  "properties": {
    "title":         { "type": "string", "minLength": 3, "maxLength": 110 },
    "slug":          { "type": "string", "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$", "maxLength": 80,
                       "description": "Optional. Defaults to the slugified title. Gets -2, -3, ... appended if taken." },
    "excerpt":       { "type": "string", "maxLength": 170, "description": "Meta description / summary. Needs 50–170 chars to publish." },
    "body":          { "type": "string", "minLength": 1, "maxLength": 100000, "description": "Markdown. Amazon Picks as [[pick:<uuid>]]; don't paste raw Amazon links here." },
    "tags":          { "type": "array", "maxItems": 10, "items": { "type": "string", "minLength": 1, "maxLength": 40 },
                       "description": "Lowercased and de-duplicated. The first tag becomes the target keyword (else the title)." },
    "coverImageUrl": { "type": "string", "format": "uri", "pattern": "^https://" },
    "productLinks":  { "type": "array", "maxItems": 12, "items": {
                         "type": "object", "required": ["url", "label"],
                         "properties": {
                           "url":   { "type": "string", "format": "uri", "pattern": "^https://" },
                           "label": { "type": "string", "minLength": 1, "maxLength": 120 } } },
                       "description": "Amazon URLs (amazon.*, amzn.to) are re-tagged with tag=mrspock-20, replacing any other tag. Other https links are stored as given." }
  }
}
```

Unknown fields are rejected, so you can't pass `status` and you can't publish through this API.
A draft is always stored with `status: "draft"` and `source: "api"`.

### Responses

- `201`:
  ```json
  { "id": "<uuid>", "slug": "gift-ideas-for-star-trek-fans", "status": "draft",
    "reviewUrl": "https://spockshop.com/admin/blog/<uuid>", "notified": true, "problems": [] }
  ```
  - `notified` tells you whether the draft-ready email went out.
  - `problems` lists the editorial rules that would block **Approve & publish**. Cooper can fix
    these in the admin editor, and the draft is saved either way. The rules: excerpt of 50–170
    chars, 3–6 Amazon Picks and/or product links in total, no prices or star ratings, no first-hand
    or review claims, no raw Amazon links in the body.
- `401` `{"error":"unauthorized"}`: the token is missing or wrong.
- `415`, `400` (bad JSON), `413`, `429`, `503`: see the limits above.
- `422` `{"error":"invalid","details":["..."]}`: the request failed validation.

Drafts are invisible to the public. `/blog`, `/blog/<slug>`, `blog.spockshop.com`, RSS and the
sitemap only show published posts.

## Delete a draft: `DELETE /api/blog/drafts/:id`

This is for cleanup. It deletes only posts that are still `draft` **and** were created by this API.
AI drafts and published or rejected posts get `409`. An unknown id gets `404`.

```bash
curl -sS -X DELETE "$BLOG_API_URL/api/blog/drafts/<id>" -H "Authorization: Bearer $BLOG_DRAFT_TOKEN"
# 200 {"id":"<id>","deleted":true}
```
