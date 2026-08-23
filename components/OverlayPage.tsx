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
    <div className="flex flex-col gap-4 p-6 font-sans" style={{ color: theme.text }}>
      <h2 className="text-2xl font-bold" style={{ color: theme.accent }}>
        {theme.label}
      </h2>
      <div className="flex h-48 items-end gap-4">
        {state.votes.map((count, i) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={i} className="flex h-full w-16 flex-col items-center justify-end">
              <div className="flex h-full w-full items-end overflow-hidden rounded bg-black/30">
                <div
                  className="w-full transition-all"
                  style={{ height: `${pct}%`, background: theme.accent }}
                />
              </div>
              <span className="mt-2 text-xl font-bold">{SLOT_LABELS[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
