import { useEffect, useState } from "react";
import type { Group } from "./groups";
import type { RoundState } from "./round";

const POLL_INTERVAL_MS = 1000;

export function useLiveState(group: Group) {
  const [state, setState] = useState<RoundState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/state/${group}`);
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data: RoundState = await res.json();
        if (!cancelled) {
          setState(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to reach server");
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [group]);

  return { state, error };
}
