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
          className="rounded border bg-white px-2 py-1 text-black"
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
