export const GROUPS = ["heroes", "villains"] as const;

export type Group = (typeof GROUPS)[number];

export function isGroup(value: string): value is Group {
  return (GROUPS as readonly string[]).includes(value);
}
