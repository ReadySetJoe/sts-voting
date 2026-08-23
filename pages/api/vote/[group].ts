import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { getRoundState, saveRoundState } from "@/lib/store";
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
  const current = await getRoundState(group);
  const result = applyVote(current, roundId, slot);
  if (!result.ok) {
    const status = result.reason === "stale_round" ? 409 : 400;
    res.status(status).json({ error: result.reason });
    return;
  }
  await saveRoundState(group, result.state);
  res.status(200).json(result.state);
}
