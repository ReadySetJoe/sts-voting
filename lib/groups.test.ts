import { describe, expect, it } from "vitest";
import { GROUPS, isGroup } from "./groups";

describe("groups", () => {
  it("lists heroes and villains", () => {
    expect(GROUPS).toEqual(["heroes", "villains"]);
  });

  it("accepts known groups", () => {
    expect(isGroup("heroes")).toBe(true);
    expect(isGroup("villains")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isGroup("wizards")).toBe(false);
    expect(isGroup("")).toBe(false);
  });
});
