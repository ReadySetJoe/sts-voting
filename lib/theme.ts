import type { Group } from "./groups";

export type GroupTheme = {
  label: string;
  tagline: string;
  background: string;
  accent: string;
  text: string;
};

export const THEMES: Record<Group, GroupTheme> = {
  heroes: {
    label: "HEROES",
    tagline: "Help the run succeed",
    background: "#1a1610",
    accent: "#d4af37",
    text: "#fdf6e3",
  },
  villains: {
    label: "VILLAINS",
    tagline: "Sabotage the run",
    background: "#150a0a",
    accent: "#b91c1c",
    text: "#f5e5e5",
  },
};

export const SLOT_LABELS = ["A", "B", "C", "D"];
