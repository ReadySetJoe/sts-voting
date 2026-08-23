import type { Group } from "./groups";

function storageKey(group: Group): string {
  return `stsv:${group}:votedRoundId`;
}

export function getVotedRoundId(group: Group): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(storageKey(group));
  } catch {
    return null;
  }
}

export function setVotedRoundId(group: Group, roundId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(group), roundId);
  } catch {
    // storage blocked; the vote already succeeded server-side, the lock is best-effort
  }
}
