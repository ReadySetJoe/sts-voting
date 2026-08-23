import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { saveRoundState } from "@/lib/store";
import { createRound, isValidSlotCount } from "@/lib/round";

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
  const { slotCount } = req.body ?? {};
  if (!isValidSlotCount(slotCount)) {
    res.status(400).json({ error: "invalid_slot_count" });
    return;
  }
  const fresh = createRound(slotCount);
  await saveRoundState(group, fresh);
  res.status(200).json(fresh);
}
