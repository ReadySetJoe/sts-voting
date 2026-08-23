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
