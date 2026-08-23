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
