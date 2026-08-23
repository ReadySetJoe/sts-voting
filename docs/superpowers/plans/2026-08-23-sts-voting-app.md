# STS Panel Voting App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hero/villain voting app — admin reset panel, two voting pages, two OBS overlay pages — backed by Upstash Redis with client-side polling for live updates.

**Architecture:** Pure round/vote logic lives in `lib/round.ts` (unit-tested). A thin Redis IO layer (`lib/store.ts`) persists one `RoundState` JSON blob per group. API routes in `pages/api/` glue HTTP to that logic. Pages are thin wrappers around three shared client components (`VotePage`, `OverlayPage`, `AdminGroupPanel`) parameterized by `group`, avoiding duplication between heroes/villains.

**Tech Stack:** Next.js 16 (Pages Router, already scaffolded), React 19, TypeScript, Tailwind CSS v4 (already configured), `@upstash/redis` (new), Vitest (new, for unit tests).

**Spec:** `docs/superpowers/specs/2026-08-23-sts-voting-design.md`

## Global Constraints

- No voter identity/auth; no admin auth (per spec, unprotected `/admin`).
- No automatic vote-winner computation — the app only displays tallies.
- Real-time updates via polling only (~1s interval) — no websockets/SSE.
- State store is Upstash Redis via REST API (`@upstash/redis`), one JSON value per group key (`round:heroes`, `round:villains`).
- Slot count is 2-4, chosen by admin per round; slots are labeled generically A/B/C/D.
- Vote lock is per-device via `localStorage`, keyed by group + `roundId` — not identity-based.
- Deployment to Vercel (env var setup, `vercel` CLI/dashboard steps) is **out of scope for this plan** — it's a manual, credentialed action the user will do together with the assistant after implementation, not something an executing agent should do unattended.
- **Prerequisite before Task 3:** a free Upstash Redis database must exist, with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` available. Task 1 creates `.env.local.example` documenting these; the human needs to create `.env.local` with real values before Task 3's manual verification step will work. Tasks 1-2 (pure logic + tests) don't need this.

---

## File Structure

```
lib/
  groups.ts          # Group type + validation
  groups.test.ts
  round.ts           # Pure round/vote logic (createRound, applyVote)
  round.test.ts
  store.ts           # Redis IO: getRoundState / saveRoundState
  useLiveState.ts     # Client polling hook
  voteLock.ts        # localStorage vote-lock helpers
  theme.ts           # Per-group display theme + slot labels

components/
  VotePage.tsx        # Shared voting UI, takes `group` prop
  OverlayPage.tsx      # Shared OBS overlay UI, takes `group` prop
  AdminGroupPanel.tsx  # Shared admin control block, takes `group` prop

pages/
  admin.tsx                        # Renders two AdminGroupPanel
  vote/heroes.tsx                  # <VotePage group="heroes" />
  vote/villains.tsx                # <VotePage group="villains" />
  overlay/heroes.tsx               # <OverlayPage group="heroes" />
  overlay/villains.tsx             # <OverlayPage group="villains" />
  api/state/[group].ts             # GET current round state
  api/vote/[group].ts              # POST a vote
  api/admin/[group]/new-round.ts   # POST start new round

.env.local.example    # Documents required env vars
vitest.config.ts
```

Voting pages/overlay pages are deliberately *not* a single dynamic `[group].tsx` page — Pages Router dynamic page routes need `getStaticPaths` or `getServerSideProps` to be well-defined, which adds nothing here since there are only two known, fixed groups. Two thin static pages per shared component keeps things simple and avoids that ambiguity. API routes don't have this issue (dynamic API routes are plain per-request handlers, no SSG involved), so those do use `[group]`.

---

### Task 1: Project setup + `lib/groups.ts`

**Files:**
- Modify: `package.json` (add `@upstash/redis`, `vitest`, `test` script)
- Create: `vitest.config.ts`
- Create: `.env.local.example`
- Modify: `.gitignore` (un-ignore the example env file)
- Create: `lib/groups.ts`
- Test: `lib/groups.test.ts`

**Interfaces:**
- Produces: `GROUPS: readonly ["heroes", "villains"]`, `type Group = "heroes" | "villains"`, `isGroup(value: string): value is Group`

- [ ] **Step 1: Install dependencies**

```bash
npm install @upstash/redis
npm install -D vitest
```

- [ ] **Step 2: Add test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Create `.env.local.example`**

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 5: Un-ignore the example file in `.gitignore`**

The existing `.gitignore` has a blanket `.env*` rule which would also hide the example file. Add this line directly after the `.env*` line:

```
!.env.local.example
```

- [ ] **Step 6: Write the failing test for `lib/groups.ts`**

```ts
// lib/groups.test.ts
import { describe, expect, it } from "vitest";
import { GROUPS, isGroup } from "./groups";

describe("groups", () => {
  it("lists heroes and villains", () => {
    expect(GROUPS).toEqual(["heroes", "villains"]);
  });

  it("accepts known groups", () => {
    expect(isGroup("heroes")).toBe(true);
    expect(isGroup("villains")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isGroup("wizards")).toBe(false);
    expect(isGroup("")).toBe(false);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run lib/groups.test.ts`
Expected: FAIL — `lib/groups.ts` does not exist yet.

- [ ] **Step 8: Implement `lib/groups.ts`**

```ts
export const GROUPS = ["heroes", "villains"] as const;

export type Group = (typeof GROUPS)[number];

export function isGroup(value: string): value is Group {
  return (GROUPS as readonly string[]).includes(value);
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run lib/groups.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.local.example .gitignore lib/groups.ts lib/groups.test.ts
git commit -m "Add project tooling and group validation"
```

---

### Task 2: Pure round/vote logic (`lib/round.ts`)

**Files:**
- Create: `lib/round.ts`
- Test: `lib/round.test.ts`

**Interfaces:**
- Consumes: `Group` from `lib/groups.ts` (not directly used in types here, but conceptually one `RoundState` per group)
- Produces:
  - `MIN_SLOTS = 2`, `MAX_SLOTS = 4`, `DEFAULT_SLOT_COUNT = 3`
  - `type RoundState = { roundId: string; slotCount: number; votes: number[] }`
  - `isValidSlotCount(n: unknown): n is number`
  - `createRound(slotCount: number): RoundState` — throws if `slotCount` invalid
  - `type VoteResult = { ok: true; state: RoundState } | { ok: false; reason: "stale_round" | "invalid_slot" }`
  - `applyVote(state: RoundState, roundId: unknown, slot: unknown): VoteResult`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/round.test.ts
import { describe, expect, it } from "vitest";
import {
  MIN_SLOTS,
  MAX_SLOTS,
  DEFAULT_SLOT_COUNT,
  isValidSlotCount,
  createRound,
  applyVote,
} from "./round";

describe("isValidSlotCount", () => {
  it("accepts 2, 3, 4", () => {
    expect(isValidSlotCount(2)).toBe(true);
    expect(isValidSlotCount(3)).toBe(true);
    expect(isValidSlotCount(4)).toBe(true);
  });

  it("rejects out-of-range or non-integer values", () => {
    expect(isValidSlotCount(1)).toBe(false);
    expect(isValidSlotCount(5)).toBe(false);
    expect(isValidSlotCount(2.5)).toBe(false);
    expect(isValidSlotCount("3")).toBe(false);
    expect(isValidSlotCount(undefined)).toBe(false);
  });
});

describe("createRound", () => {
  it("creates a round with the given slot count and zeroed votes", () => {
    const round = createRound(3);
    expect(round.slotCount).toBe(3);
    expect(round.votes).toEqual([0, 0, 0]);
    expect(typeof round.roundId).toBe("string");
    expect(round.roundId.length).toBeGreaterThan(0);
  });

  it("generates a different roundId each call", () => {
    const a = createRound(3);
    const b = createRound(3);
    expect(a.roundId).not.toBe(b.roundId);
  });

  it("throws for an invalid slot count", () => {
    expect(() => createRound(1)).toThrow();
    expect(() => createRound(5)).toThrow();
  });
});

describe("applyVote", () => {
  it("increments the target slot on a matching roundId", () => {
    const round = createRound(3);
    const result = applyVote(round, round.roundId, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.votes).toEqual([0, 1, 0]);
      // original state is untouched
      expect(round.votes).toEqual([0, 0, 0]);
    }
  });

  it("rejects a stale roundId", () => {
    const round = createRound(3);
    const result = applyVote(round, "not-the-real-round-id", 0);
    expect(result).toEqual({ ok: false, reason: "stale_round" });
  });

  it("rejects a slot beyond slotCount", () => {
    const round = createRound(2);
    const result = applyVote(round, round.roundId, 2);
    expect(result).toEqual({ ok: false, reason: "invalid_slot" });
  });

  it("rejects a negative or non-integer slot", () => {
    const round = createRound(3);
    expect(applyVote(round, round.roundId, -1)).toEqual({
      ok: false,
      reason: "invalid_slot",
    });
    expect(applyVote(round, round.roundId, 1.5)).toEqual({
      ok: false,
      reason: "invalid_slot",
    });
    expect(applyVote(round, round.roundId, "1")).toEqual({
      ok: false,
      reason: "invalid_slot",
    });
  });
});

describe("constants", () => {
  it("exposes the expected slot bounds", () => {
    expect(MIN_SLOTS).toBe(2);
    expect(MAX_SLOTS).toBe(4);
    expect(DEFAULT_SLOT_COUNT).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/round.test.ts`
Expected: FAIL — `lib/round.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/round.ts`**

```ts
import { randomUUID } from "node:crypto";

export const MIN_SLOTS = 2;
export const MAX_SLOTS = 4;
export const DEFAULT_SLOT_COUNT = 3;

export type RoundState = {
  roundId: string;
  slotCount: number;
  votes: number[];
};

export function isValidSlotCount(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= MIN_SLOTS &&
    n <= MAX_SLOTS
  );
}

export function createRound(slotCount: number): RoundState {
  if (!isValidSlotCount(slotCount)) {
    throw new Error(`invalid slot count: ${slotCount}`);
  }
  return {
    roundId: randomUUID(),
    slotCount,
    votes: new Array(slotCount).fill(0),
  };
}

export type VoteResult =
  | { ok: true; state: RoundState }
  | { ok: false; reason: "stale_round" | "invalid_slot" };

export function applyVote(
  state: RoundState,
  roundId: unknown,
  slot: unknown
): VoteResult {
  if (roundId !== state.roundId) {
    return { ok: false, reason: "stale_round" };
  }
  if (
    typeof slot !== "number" ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= state.slotCount
  ) {
    return { ok: false, reason: "invalid_slot" };
  }
  const votes = state.votes.slice();
  votes[slot] += 1;
  return { ok: true, state: { ...state, votes } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/round.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add lib/round.ts lib/round.test.ts
git commit -m "Add pure round/vote logic with unit tests"
```

---

### Task 3: Redis store + `GET /api/state/[group]`

**Files:**
- Create: `lib/store.ts`
- Create: `pages/api/state/[group].ts`

**Interfaces:**
- Consumes: `Group`, `isGroup` from `lib/groups.ts`; `RoundState`, `createRound`, `DEFAULT_SLOT_COUNT` from `lib/round.ts`
- Produces: `getRoundState(group: Group): Promise<RoundState>`, `saveRoundState(group: Group, state: RoundState): Promise<void>` — later tasks (vote, new-round) call both.

This task has no automated test (it requires a live Redis connection); it's verified manually against a real Upstash database, per the spec's testing approach (pure logic is unit-tested, IO/integration is verified by hand).

- [ ] **Step 1: Implement `lib/store.ts`**

```ts
import { Redis } from "@upstash/redis";
import type { Group } from "./groups";
import { createRound, DEFAULT_SLOT_COUNT, type RoundState } from "./round";

let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}

function roundKey(group: Group): string {
  return `round:${group}`;
}

export async function getRoundState(group: Group): Promise<RoundState> {
  const existing = await getClient().get<RoundState>(roundKey(group));
  if (existing) {
    return existing;
  }
  const fresh = createRound(DEFAULT_SLOT_COUNT);
  await getClient().set(roundKey(group), fresh);
  return fresh;
}

export async function saveRoundState(
  group: Group,
  state: RoundState
): Promise<void> {
  await getClient().set(roundKey(group), state);
}
```

- [ ] **Step 2: Implement `pages/api/state/[group].ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { getRoundState } from "@/lib/store";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { group } = req.query;
  if (typeof group !== "string" || !isGroup(group)) {
    res.status(404).json({ error: "unknown group" });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const state = await getRoundState(group);
  res.status(200).json(state);
}
```

- [ ] **Step 3: Manual verification**

Prerequisite: `.env.local` must exist with real `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` values (copy from `.env.local.example`).

Run: `npm run dev`, then in another terminal:

```bash
curl -s http://localhost:3000/api/state/heroes | jq
curl -s http://localhost:3000/api/state/villains | jq
curl -s http://localhost:3000/api/state/wizards -w '\n%{http_code}\n'
```

Expected:
- `heroes`/`villains` each return `{"roundId": "...", "slotCount": 3, "votes": [0,0,0]}` on first call, and the *same* `roundId` on a second call (confirms it's not re-created every request).
- `wizards` returns 404.

- [ ] **Step 4: Commit**

```bash
git add lib/store.ts pages/api/state
git commit -m "Add Redis-backed round state store and GET /api/state/[group]"
```

---

### Task 4: `POST /api/vote/[group]`

**Files:**
- Create: `pages/api/vote/[group].ts`

**Interfaces:**
- Consumes: `isGroup` (`lib/groups.ts`); `getRoundState`, `saveRoundState` (`lib/store.ts`); `applyVote` (`lib/round.ts`)

- [ ] **Step 1: Implement `pages/api/vote/[group].ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { getRoundState, saveRoundState } from "@/lib/store";
import { applyVote } from "@/lib/round";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { group } = req.query;
  if (typeof group !== "string" || !isGroup(group)) {
    res.status(404).json({ error: "unknown group" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const { roundId, slot } = req.body ?? {};
  const current = await getRoundState(group);
  const result = applyVote(current, roundId, slot);
  if (!result.ok) {
    const status = result.reason === "stale_round" ? 409 : 400;
    res.status(status).json({ error: result.reason });
    return;
  }
  await saveRoundState(group, result.state);
  res.status(200).json(result.state);
}
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running:

```bash
ROUND_ID=$(curl -s http://localhost:3000/api/state/heroes | jq -r .roundId)

curl -s -X POST http://localhost:3000/api/vote/heroes \
  -H 'Content-Type: application/json' \
  -d "{\"roundId\": \"$ROUND_ID\", \"slot\": 1}" | jq

curl -s -X POST http://localhost:3000/api/vote/heroes \
  -H 'Content-Type: application/json' \
  -d '{"roundId": "not-real", "slot": 0}' -w '\n%{http_code}\n'

curl -s -X POST http://localhost:3000/api/vote/heroes \
  -H 'Content-Type: application/json' \
  -d "{\"roundId\": \"$ROUND_ID\", \"slot\": 99}" -w '\n%{http_code}\n'
```

Expected: first call returns `votes: [0,1,0]`; second call returns 409 with `{"error":"stale_round"}`; third call returns 400 with `{"error":"invalid_slot"}`.

- [ ] **Step 3: Commit**

```bash
git add pages/api/vote
git commit -m "Add POST /api/vote/[group]"
```

---

### Task 5: `POST /api/admin/[group]/new-round`

**Files:**
- Create: `pages/api/admin/[group]/new-round.ts`

**Interfaces:**
- Consumes: `isGroup` (`lib/groups.ts`); `saveRoundState` (`lib/store.ts`); `createRound`, `isValidSlotCount` (`lib/round.ts`)

- [ ] **Step 1: Implement `pages/api/admin/[group]/new-round.ts`**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { saveRoundState } from "@/lib/store";
import { createRound, isValidSlotCount } from "@/lib/round";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { group } = req.query;
  if (typeof group !== "string" || !isGroup(group)) {
    res.status(404).json({ error: "unknown group" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const { slotCount } = req.body ?? {};
  if (!isValidSlotCount(slotCount)) {
    res.status(400).json({ error: "invalid_slot_count" });
    return;
  }
  const fresh = createRound(slotCount);
  await saveRoundState(group, fresh);
  res.status(200).json(fresh);
}
```

- [ ] **Step 2: Manual verification**

```bash
OLD_ROUND_ID=$(curl -s http://localhost:3000/api/state/heroes | jq -r .roundId)

curl -s -X POST http://localhost:3000/api/admin/heroes/new-round \
  -H 'Content-Type: application/json' \
  -d '{"slotCount": 4}' | jq

# old roundId should now be rejected:
curl -s -X POST http://localhost:3000/api/vote/heroes \
  -H 'Content-Type: application/json' \
  -d "{\"roundId\": \"$OLD_ROUND_ID\", \"slot\": 0}" -w '\n%{http_code}\n'
```

Expected: new-round response has a fresh `roundId`, `slotCount: 4`, `votes: [0,0,0,0]`; the follow-up vote with the old `roundId` returns 409.

- [ ] **Step 3: Commit**

```bash
git add pages/api/admin
git commit -m "Add POST /api/admin/[group]/new-round"
```

---

### Task 6: Client polling hook, vote lock, and theme

**Files:**
- Create: `lib/useLiveState.ts`
- Create: `lib/voteLock.ts`
- Create: `lib/theme.ts`

**Interfaces:**
- Consumes: `Group` (`lib/groups.ts`), `RoundState` (`lib/round.ts`)
- Produces:
  - `useLiveState(group: Group): { state: RoundState | null; error: string | null }`
  - `getVotedRoundId(group: Group): string | null`, `setVotedRoundId(group: Group, roundId: string): void`
  - `THEMES: Record<Group, GroupTheme>` where `GroupTheme = { label: string; tagline: string; background: string; accent: string; text: string }`
  - `SLOT_LABELS: string[]` (`["A", "B", "C", "D"]`)

These are consumed directly by UI components in Tasks 7-9 and are verified together with them in the browser; no standalone automated test (they're either trivial constants or thin browser-API wrappers with no meaningful pure-logic branch to unit test).

- [ ] **Step 1: Implement `lib/useLiveState.ts`**

```ts
import { useEffect, useState } from "react";
import type { Group } from "./groups";
import type { RoundState } from "./round";

const POLL_INTERVAL_MS = 1000;

export function useLiveState(group: Group) {
  const [state, setState] = useState<RoundState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/state/${group}`);
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data: RoundState = await res.json();
        if (!cancelled) {
          setState(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to reach server");
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [group]);

  return { state, error };
}
```

- [ ] **Step 2: Implement `lib/voteLock.ts`**

```ts
import type { Group } from "./groups";

function storageKey(group: Group): string {
  return `stsv:${group}:votedRoundId`;
}

export function getVotedRoundId(group: Group): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(storageKey(group));
}

export function setVotedRoundId(group: Group, roundId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(group), roundId);
}
```

- [ ] **Step 3: Implement `lib/theme.ts`**

```ts
import type { Group } from "./groups";

export type GroupTheme = {
  label: string;
  tagline: string;
  background: string;
  accent: string;
  text: string;
};

export const THEMES: Record<Group, GroupTheme> = {
  heroes: {
    label: "HEROES",
    tagline: "Help the run succeed",
    background: "#1a1610",
    accent: "#d4af37",
    text: "#fdf6e3",
  },
  villains: {
    label: "VILLAINS",
    tagline: "Sabotage the run",
    background: "#150a0a",
    accent: "#b91c1c",
    text: "#f5e5e5",
  },
};

export const SLOT_LABELS = ["A", "B", "C", "D"];
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS (groups + round tests still passing; TypeScript compiles cleanly alongside).

- [ ] **Step 5: Commit**

```bash
git add lib/useLiveState.ts lib/voteLock.ts lib/theme.ts
git commit -m "Add client polling hook, vote lock, and group theme"
```

---

### Task 7: Voting pages

**Files:**
- Create: `components/VotePage.tsx`
- Create: `pages/vote/heroes.tsx`
- Create: `pages/vote/villains.tsx`

**Interfaces:**
- Consumes: `Group` (`lib/groups.ts`), `useLiveState` (`lib/useLiveState.ts`), `getVotedRoundId`/`setVotedRoundId` (`lib/voteLock.ts`), `THEMES`/`SLOT_LABELS` (`lib/theme.ts`)
- Produces: `VotePage({ group }: { group: Group })` component, used by both thin pages.

- [ ] **Step 1: Implement `components/VotePage.tsx`**

```tsx
import { useState } from "react";
import type { Group } from "@/lib/groups";
import { useLiveState } from "@/lib/useLiveState";
import { getVotedRoundId, setVotedRoundId } from "@/lib/voteLock";
import { THEMES, SLOT_LABELS } from "@/lib/theme";

export default function VotePage({ group }: { group: Group }) {
  const { state, error } = useLiveState(group);
  const [pending, setPending] = useState(false);
  const theme = THEMES[group];

  const votedRoundId = state ? getVotedRoundId(group) : null;
  const locked = state !== null && votedRoundId === state.roundId;

  async function vote(slot: number) {
    if (!state || locked || pending) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/vote/${group}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: state.roundId, slot }),
      });
      if (res.ok) {
        setVotedRoundId(group, state.roundId);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{ background: theme.background, color: theme.text }}
      className="flex min-h-screen flex-col items-center justify-center gap-8 p-8"
    >
      <h1
        className="text-4xl font-bold tracking-wide"
        style={{ color: theme.accent }}
      >
        {theme.label}
      </h1>
      <p className="text-lg opacity-80">{theme.tagline}</p>
      {error && <p className="text-red-400">{error}</p>}
      {!state ? (
        <p>Loading...</p>
      ) : locked ? (
        <p className="text-xl">
          Thanks for voting! Waiting for the next round...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {state.votes.map((_, i) => (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={pending}
              className="rounded-xl px-12 py-10 text-3xl font-bold shadow-lg transition hover:scale-105 disabled:opacity-50"
              style={{ background: theme.accent, color: theme.background }}
            >
              {SLOT_LABELS[i]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `pages/vote/heroes.tsx`**

```tsx
import VotePage from "@/components/VotePage";

export default function HeroesVotePage() {
  return <VotePage group="heroes" />;
}
```

- [ ] **Step 3: Implement `pages/vote/villains.tsx`**

```tsx
import VotePage from "@/components/VotePage";

export default function VillainsVotePage() {
  return <VotePage group="villains" />;
}
```

- [ ] **Step 4: Manual verification in browser**

With `npm run dev` running:
1. Open `http://localhost:3000/vote/heroes` and `http://localhost:3000/vote/villains` in two tabs.
2. Click a slot on the heroes page — button area should switch to the "Thanks for voting" locked message.
3. Reload the heroes page — it should still show locked (localStorage persisted).
4. Via curl, start a new round for heroes (`POST /api/admin/heroes/new-round` with a body like `{"slotCount": 3}`), then reload the heroes vote page — it should unlock and show fresh buttons.
5. Confirm the villains page is unaffected by the heroes reset (independent state).

- [ ] **Step 5: Commit**

```bash
git add components/VotePage.tsx pages/vote
git commit -m "Add hero and villain voting pages"
```

---

### Task 8: Admin panel

**Files:**
- Create: `components/AdminGroupPanel.tsx`
- Create: `pages/admin.tsx`

**Interfaces:**
- Consumes: `Group` (`lib/groups.ts`), `useLiveState` (`lib/useLiveState.ts`), `THEMES`/`SLOT_LABELS` (`lib/theme.ts`)
- Produces: `AdminGroupPanel({ group }: { group: Group })` component; `pages/admin.tsx` renders one per group.

- [ ] **Step 1: Implement `components/AdminGroupPanel.tsx`**

```tsx
import { useState } from "react";
import type { Group } from "@/lib/groups";
import { useLiveState } from "@/lib/useLiveState";
import { THEMES, SLOT_LABELS } from "@/lib/theme";

export default function AdminGroupPanel({ group }: { group: Group }) {
  const { state, error } = useLiveState(group);
  const [slotCount, setSlotCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const theme = THEMES[group];

  async function startNewRound() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/${group}/new-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotCount }),
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
    } catch {
      setActionError("Failed to start new round");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-6"
      style={{ borderColor: theme.accent }}
    >
      <h2 className="mb-4 text-2xl font-bold" style={{ color: theme.accent }}>
        {theme.label}
      </h2>
      {error && <p className="text-red-400">{error}</p>}
      {state && (
        <div className="mb-4 space-y-1 font-mono text-sm">
          <p>Round: {state.roundId.slice(0, 8)}</p>
          <p>Slots: {state.slotCount}</p>
          <p>
            Votes:{" "}
            {state.votes.map((v, i) => `${SLOT_LABELS[i]}=${v}`).join("  ")}
          </p>
        </div>
      )}
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor={`${group}-slots`}>Slots:</label>
        <select
          id={`${group}-slots`}
          value={slotCount}
          onChange={(e) => setSlotCount(Number(e.target.value))}
          className="rounded border px-2 py-1 text-black"
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </div>
      <button
        onClick={startNewRound}
        disabled={busy}
        className="rounded px-4 py-2 font-bold text-white disabled:opacity-50"
        style={{ background: theme.accent }}
      >
        Start New Round
      </button>
      {actionError && <p className="mt-2 text-red-400">{actionError}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Implement `pages/admin.tsx`**

```tsx
import AdminGroupPanel from "@/components/AdminGroupPanel";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="mb-8 text-3xl font-bold">STS Panel Voting — Admin</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <AdminGroupPanel group="heroes" />
        <AdminGroupPanel group="villains" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification in browser**

1. Open `http://localhost:3000/admin` and `http://localhost:3000/vote/heroes` in separate tabs.
2. Vote on the heroes page; within ~1s the admin panel's heroes vote counts should update on their own (no reload).
3. Change the heroes slot picker to 4 and click "Start New Round"; the heroes vote tally should reset to `A=0 B=0 C=0 D=0` and the vote page (after its next poll) should unlock with 4 buttons.
4. Confirm the villains panel/tally is untouched by the heroes reset.

- [ ] **Step 4: Commit**

```bash
git add components/AdminGroupPanel.tsx pages/admin.tsx
git commit -m "Add admin panel with independent hero/villain reset controls"
```

---

### Task 9: OBS overlay pages

**Files:**
- Create: `components/OverlayPage.tsx`
- Create: `pages/overlay/heroes.tsx`
- Create: `pages/overlay/villains.tsx`

**Interfaces:**
- Consumes: `Group` (`lib/groups.ts`), `useLiveState` (`lib/useLiveState.ts`), `THEMES`/`SLOT_LABELS` (`lib/theme.ts`)
- Produces: `OverlayPage({ group }: { group: Group })` component, used by both thin pages.

- [ ] **Step 1: Implement `components/OverlayPage.tsx`**

```tsx
import { useEffect } from "react";
import type { Group } from "@/lib/groups";
import { useLiveState } from "@/lib/useLiveState";
import { THEMES, SLOT_LABELS } from "@/lib/theme";

export default function OverlayPage({ group }: { group: Group }) {
  const { state } = useLiveState(group);
  const theme = THEMES[group];

  useEffect(() => {
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = "";
    };
  }, []);

  if (!state) {
    return null;
  }

  const total = state.votes.reduce((sum, v) => sum + v, 0);

  return (
    <div className="flex flex-col gap-3 p-6 font-sans" style={{ color: theme.text }}>
      <h2 className="text-2xl font-bold" style={{ color: theme.accent }}>
        {theme.label}
      </h2>
      {state.votes.map((count, i) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-6 text-xl font-bold">{SLOT_LABELS[i]}</span>
            <div className="h-6 w-64 overflow-hidden rounded bg-black/30">
              <div
                className="h-full transition-all"
                style={{ width: `${pct}%`, background: theme.accent }}
              />
            </div>
            <span className="w-16 text-right text-lg">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement `pages/overlay/heroes.tsx`**

```tsx
import OverlayPage from "@/components/OverlayPage";

export default function HeroesOverlayPage() {
  return <OverlayPage group="heroes" />;
}
```

- [ ] **Step 3: Implement `pages/overlay/villains.tsx`**

```tsx
import OverlayPage from "@/components/OverlayPage";

export default function VillainsOverlayPage() {
  return <OverlayPage group="villains" />;
}
```

- [ ] **Step 4: Manual verification in browser**

1. Open `http://localhost:3000/overlay/heroes`. Open browser dev tools and confirm `document.body`'s computed `background-color` is transparent (not the page's default white/dark).
2. In another tab, vote on `http://localhost:3000/vote/heroes` — within ~1s the overlay bars/counts should update live.
3. Repeat for `/overlay/villains` + `/vote/villains`.
4. (If you have OBS available) add `http://localhost:3000/overlay/heroes` as a Browser Source and confirm no white/black box appears behind it.

- [ ] **Step 5: Commit**

```bash
git add components/OverlayPage.tsx pages/overlay
git commit -m "Add OBS overlay pages for heroes and villains"
```

---

## After this plan

Once all 9 tasks are done and verified, the app is fully working against a real Upstash Redis database via `npm run dev`. Deployment to Vercel (creating the project, setting `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` as env vars, and getting public URLs for `/admin`, `/vote/*`, `/overlay/*`) is a manual follow-up step to do together, not part of this plan.
