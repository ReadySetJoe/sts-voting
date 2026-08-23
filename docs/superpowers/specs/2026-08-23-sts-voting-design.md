# Slay the Spire Panel Voting App — Design

## Purpose

A live convention panel app where the audience splits into two groups:

- **Heroes** vote to help the host win their Slay the Spire run.
- **Villains** vote to sabotage it.

Both groups vote on the same kind of thing (e.g. "which of these 3 cards should be picked"), but via independent voting pages and independent tallies. The host reads both tallies and manually decides the in-run outcome — the app never computes a winner. A stream overlay shows both tallies live during the panel.

## Non-goals

- No automatic vote-resolution logic (host decides manually).
- No voter identity/auth — anonymous, open links.
- No admin authentication — `/admin` is unprotected by request.
- No persistent history of past rounds — only current round state matters.

## Deployment target

Deployed to the public internet (e.g. Vercel), not run from a laptop on local WiFi. This rules out in-memory server state, since serverless function instances are ephemeral and not shared — state must live in an external store.

## Data model

Two independent "rooms," one per group: `heroes` and `villains`. Each is a single JSON value in Redis:

```ts
type RoundState = {
  roundId: string      // changes every time admin starts a new round
  slotCount: number    // 2-4, set by admin per round
  votes: number[]      // length == slotCount, index 0 = "A", 1 = "B", etc.
}
```

Stored under Redis keys `round:heroes` and `round:villains`.

**Store choice:** Upstash Redis, accessed via its REST API (`@upstash/redis` package). Chosen over alternatives (Vercel KV is Upstash-backed anyway; Supabase/Postgres is unnecessary relational overhead for two JSON blobs) because it needs no persistent connection — a plain HTTPS call per request — which fits serverless functions cleanly, and has a free tier sufficient for this workload.

## Real-time updates

Plain client-side polling: voting pages and overlays `fetch` `/api/state/[group]` on an interval (~1s) and re-render. No websockets/SSE — not needed at this scale, and avoids the complexity of running a persistent connection on a serverless host.

## Round lifecycle

1. Admin picks a slot count (2, 3, or 4) for a group and clicks "Start New Round."
2. Server generates a new `roundId`, resets `votes` to all zeros, stores the new `slotCount`.
3. Voting pages/overlays polling that group pick up the new `roundId` and `slotCount` on their next poll tick.
4. A device that already voted in the *previous* `roundId` is unlocked automatically, because its localStorage lock is keyed by `roundId`.

Heroes and villains rounds are entirely independent — admin has separate controls and can reset one without affecting the other.

## Vote flow & anti-spam

- Voting pages read `localStorage["stsv:<group>:votedRoundId"]`.
- If it matches the current `roundId`, the UI shows "vote locked, waiting for next round" and disables all buttons.
- On vote, `POST /api/vote/[group]` with `{ roundId, slot }`. Server:
  - Rejects (409) if the posted `roundId` doesn't match the currently stored `roundId` (stale round — a backstop against a client that polled slowly or replayed a request).
  - Otherwise increments `votes[slot]` and returns the updated state.
- On success, client writes `localStorage["stsv:<group>:votedRoundId"] = roundId` and locks the UI.

This is a device-level lock (localStorage), not identity-based — acceptable per the "anonymous, open link" decision. It deters accidental double-voting/spam-clicking, not a determined adversary, which is fine for a con panel.

## Routes

### API (`pages/api/`)

- `GET /api/state/[group]` → `{ roundId, slotCount, votes }` for `group` in `{heroes, villains}`. 404 for any other value.
- `POST /api/vote/[group]` → body `{ roundId: string, slot: number }`. Validates `slot < slotCount`. Returns updated state or 409 on stale round.
- `POST /api/admin/[group]/new-round` → body `{ slotCount: number }` (2-4). Returns the new state.

All group-scoped routes validate `group` against `{heroes, villains}` and 404 otherwise.

### Pages (`pages/`)

- `/admin` — two side-by-side (or stacked, responsive) panels, one per group:
  - Current round info (roundId shortened, slot count, live vote counts as plain numbers).
  - Slot count picker (2/3/4).
  - "Start New Round" button.
  - No login/auth.
- `/vote/heroes`, `/vote/villains` — full-screen, big tappable buttons labeled A/B/C(/D) sized to `slotCount`. Locked state shows a "thanks for voting, waiting for the next round" message. Group-specific styling (heroes: light/gold; villains: dark/red), Slay the Spire-flavored but simple (no need for pixel-perfect game asset recreation).
- `/overlay/heroes`, `/overlay/villains` — transparent-background (for OBS browser source) bars or counts per slot, live-updating, styled per group. No interactivity.

## Error handling

- If Redis is unreachable, API routes return 500. Polling clients simply retry on the next tick — no special user-facing error state needed for the demo use case.
- Admin "Start New Round" surfaces a simple inline error if the request fails, so the host isn't left thinking a reset happened when it didn't.

## Testing

- Unit tests for the pure round/vote logic (new-round reset, vote increment, stale-round rejection, invalid slot/group rejection) — this is the logic worth protecting since a bug here directly breaks the panel live.
- Pages and overlay are primarily visual/interactive — verified manually in the browser (voting flow, lock/unlock across a round reset, overlay rendering) rather than via automated UI tests, given the scope and one-off nature of this app.

## Setup / operational notes

- Requires a free Upstash Redis database; `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set as env vars (Vercel project settings for prod, `.env.local` for dev).
- Built on the existing Next.js 16 Pages Router scaffold already in this repo (`pages/`, `pages/api/`) — no router migration needed; confirmed Pages Router API routes work as expected in this Next.js version via the bundled docs.
