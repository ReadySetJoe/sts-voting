import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { getRoundMetaForGroup, incrementVote } from "@/lib/store";
import { applyVote } from "@/lib/round";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { group } = req.query;
  if (typeof group !== "string" || !isGroup(group)) {
    res.status(404).json({ error: "unknown group" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const { roundId, slot } = req.body ?? {};
  const meta = await getRoundMetaForGroup(group);
  const validation = applyVote(
    { roundId: meta.roundId, slotCount: meta.slotCount, votes: [] },
    roundId,
    slot
  );
  if (!validation.ok) {
    const status = validation.reason === "stale_round" ? 409 : 400;
    res.status(status).json({ error: validation.reason });
    return;
  }
  const votes = await incrementVote(group, meta.roundId, slot, meta.slotCount);
  res.status(200).json({ roundId: meta.roundId, slotCount: meta.slotCount, votes });
}
