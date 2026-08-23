import type { NextApiRequest, NextApiResponse } from "next";
import { isGroup } from "@/lib/groups";
import { getRoundState } from "@/lib/store";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { group } = req.query;
  if (typeof group !== "string" || !isGroup(group)) {
    res.status(404).json({ error: "unknown group" });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const state = await getRoundState(group);
  res.status(200).json(state);
}
