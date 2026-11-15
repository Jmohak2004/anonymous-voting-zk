// @vitest-environment node
import { describe, it, expect } from "vitest";
import { toPollView } from "./contract";

describe("toPollView", () => {
  it("maps the raw getPoll tuple to a typed view with a named phase", () => {
    const view = toPollView(3n, {
      creator: "0x1",
      question: "Lunch?",
      options: ["Pizza", "Sushi"],
      phase: 1n,
      memberCount: 4n,
      root: 99n,
    });
    expect(view).toEqual({
      id: 3n, creator: "0x1", question: "Lunch?", options: ["Pizza", "Sushi"],
      phase: "Voting", memberCount: 4, root: 99n,
    });
  });
});
