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

type RoundMeta = { roundId: string; slotCount: number };

function metaKey(group: Group): string {
  return `round:${group}`;
}

function votesKey(group: Group, roundId: string): string {
  return `votes:${group}:${roundId}`;
}

const VOTES_TTL_SECONDS = 6 * 60 * 60;

async function getRoundMeta(group: Group): Promise<RoundMeta> {
  const key = metaKey(group);
  const existing = await getClient().get<RoundMeta>(key);
  if (existing) {
    return existing;
  }
  const fresh = createRound(DEFAULT_SLOT_COUNT);
  const meta: RoundMeta = { roundId: fresh.roundId, slotCount: fresh.slotCount };
  const created = await getClient().set(key, meta, { nx: true });
  if (created) {
    return meta;
  }
  const winner = await getClient().get<RoundMeta>(key);
  return winner ?? meta;
}

function votesHashToArray(
  hash: Record<string, unknown> | null,
  slotCount: number
): number[] {
  const votes = new Array(slotCount).fill(0);
  if (!hash) {
    return votes;
  }
  for (let i = 0; i < slotCount; i++) {
    const raw = hash[String(i)];
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "0"), 10);
    votes[i] = Number.isFinite(n) ? n : 0;
  }
  return votes;
}

export async function getRoundState(group: Group): Promise<RoundState> {
  const meta = await getRoundMeta(group);
  const hash = await getClient().hgetall<Record<string, unknown>>(
    votesKey(group, meta.roundId)
  );
  return {
    roundId: meta.roundId,
    slotCount: meta.slotCount,
    votes: votesHashToArray(hash, meta.slotCount),
  };
}

export async function getRoundMetaForGroup(group: Group): Promise<RoundMeta> {
  return getRoundMeta(group);
}

export async function incrementVote(
  group: Group,
  roundId: string,
  slot: number,
  slotCount: number
): Promise<number[]> {
  const key = votesKey(group, roundId);
  await getClient().hincrby(key, String(slot), 1);
  await getClient().expire(key, VOTES_TTL_SECONDS);
  const hash = await getClient().hgetall<Record<string, unknown>>(key);
  return votesHashToArray(hash, slotCount);
}

export async function startNewRound(
  group: Group,
  slotCount: number
): Promise<RoundState> {
  const fresh = createRound(slotCount);
  const meta: RoundMeta = { roundId: fresh.roundId, slotCount: fresh.slotCount };
  await getClient().set(metaKey(group), meta);
  return fresh;
}
