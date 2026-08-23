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
