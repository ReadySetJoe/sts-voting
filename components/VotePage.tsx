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
