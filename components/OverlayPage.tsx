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
