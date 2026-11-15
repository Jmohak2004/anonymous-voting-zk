import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Results from "./Results";

describe("Results", () => {
  it("renders counts and percentages", () => {
    render(<Results options={["Pizza", "Sushi"]} tally={[3n, 1n]} />);
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText(/3 votes · 75%/)).toBeInTheDocument();
    expect(screen.getByText(/1 vote · 25%/)).toBeInTheDocument();
    expect(screen.getByText(/4 votes total/)).toBeInTheDocument();
  });

  it("handles zero total votes without NaN", () => {
    render(<Results options={["A", "B"]} tally={[0n, 0n]} />);
    expect(screen.getAllByText(/0 votes · 0%/)).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
