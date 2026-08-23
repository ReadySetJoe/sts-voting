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
