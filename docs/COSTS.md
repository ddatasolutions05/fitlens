# External services and costs

Figures are list prices at the time of writing (2026-10-27) for one heavy user:
about 6 meal photos a day, each with one analysis and occasional retries.

| Service | Free tier | Likely monthly cost (one heavy user) | Notes |
|---|---|---|---|
| Supabase (Postgres, Auth, Storage, Edge Functions) | 500 MB database, 1 GB storage, 500k edge invocations, 50k monthly active users | $0 on the free tier; $25 on Pro if the project must not pause after a week of inactivity | Food database import is about 14k rows plus 34k servings, well under 500 MB. Photos at about 250 KB each: 6 a day is 45 MB a month. |
| Anthropic API (vision + coach phrasing) | None | See per-photo figures below; about $3 to $6 a month at 6 photos a day on the default model | Set `VISION_MODEL` to change the trade-off. |
| USDA FoodData Central API (branded foods) | Free with an API key, 1,000 requests an hour | $0 | Only used when `FDC_API_KEY` is set. Foundation and SR Legacy are imported, not queried. |
| Health Canada CNF | Open data download | $0 | Imported once. |
| Open Food Facts | Free, ODbL | $0 | Runtime barcode lookups with a descriptive User-Agent. |
| Expo / EAS | Expo Go and web are free; EAS Build has a free tier with queue limits | $0 for web and Expo Go | Native builds for HealthKit and Health Connect would use EAS Build or a local toolchain. |

## Cost per photo analysis

A 1,600 px JPEG is roughly 1,600 input tokens; the system prompt is about 900
tokens; the response is 400 to 900 output tokens. One analysis is therefore
about 2,500 input and 700 output tokens. A validation retry doubles that.

| `VISION_MODEL` | Input $/M | Output $/M | Cost per analysis | 180 analyses a month |
|---|---|---|---|---|
| `claude-opus-5-5` (default) | 4.00 | 20.00 | about $0.024 | about $4.30 |
| `claude-sonnet-5-5` | 2.00 | 10.00 | about $0.012 | about $2.20 |
| `claude-haiku-5-5` | 0.10 | 0.50 | about $0.0006 | about $0.11 |

Label reads cost about half of a meal analysis (one image, shorter output).

The function records `est_cost_usd` per analysis in `photo_analyses` and a daily
sum in `ai_usage`, so actual spend is visible per user and per day. The daily
cap (`AI_DAILY_LIMIT`, default 30) bounds the worst case at about $0.72 a day
on the default model.

## What is not charged

- Everything in `packages/core` runs on the device.
- Rule-based post-meal feedback and the Today insight never call the API.
- Search, recents, favourites, manual entry, weight, activity and water are
  plain database reads and writes.
