import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StreakPill, streakMode } from "./streak-pill";
import { HabitRow } from "./habit-row";
import { Heatmap, intensityStyle } from "./heatmap";

const base = {
  id: "h1",
  title: "Practice",
  icon: "check",
  color: "moss",
  value: 0,
  target: null,
  unit: null,
  done: false,
  streak: 0,
};

describe("StreakPill", () => {
  it("does not render zero", () =>
    expect(render(<StreakPill streak={0} />).container).toBeEmptyDOMElement());
  it("selects neutral, hot and record modes", () => {
    expect(streakMode(3)).toBe("neutral");
    expect(streakMode(7)).toBe("hot");
    expect(streakMode(2, true)).toBe("record");
  });
  it.each([
    [3, "neutral"],
    [7, "hot"],
    [2, "record"],
  ] as const)("renders %s as %s", (streak, mode) => {
    render(<StreakPill streak={streak} isPersonalRecord={mode === "record"} />);
    expect(screen.getByText(String(streak)).closest("span")).toHaveAttribute("data-mode", mode);
  });
});

describe("HabitRow", () => {
  it.each(["binary", "counter", "duration"] as const)("renders %s behavior", (type) => {
    const props =
      type === "binary"
        ? { ...base, type }
        : {
            ...base,
            type,
            target: type === "counter" ? 10 : 30,
            unit: type === "counter" ? "pages" : "min",
          };
    const { container } = render(<HabitRow {...props} />);
    expect(container.querySelector("form")).toHaveAttribute("data-habit-type", type);
    if (type !== "counter")
      expect(screen.getByRole("button", { name: /complete/i })).toBeInTheDocument();
    else expect(screen.getByRole("button", { name: /increase/i })).toBeInTheDocument();
  });
  it("keeps the counter below a shrink-safe title", () => {
    render(<HabitRow {...base} type="counter" target={20} unit="pages" />);
    expect(screen.getByTestId("habit-content")).toHaveClass("min-w-0", "flex-1");
    expect(screen.getByTestId("habit-title-container")).toHaveClass("min-w-0");
    expect(screen.getByTestId("counter-row")).toBeInTheDocument();
  });
  it("uses an anchor by default and the supplied link renderer when provided", () => {
    const first = render(<HabitRow {...base} type="binary" />);
    expect(first.getByRole("link", { name: /practice/i })).toHaveAttribute("href", "/habit/h1");
    first.unmount();
    const renderLink = vi.fn(({ href, children }: { href: string; children: React.ReactNode }) => (
      <span data-testid="custom-link" data-href={href}>
        {children}
      </span>
    ));
    render(<HabitRow {...base} type="binary" renderLink={renderLink} />);
    expect(screen.getByTestId("custom-link")).toHaveAttribute("data-href", "/habit/h1");
    expect(renderLink).toHaveBeenCalledOnce();
  });
});

describe("Heatmap", () => {
  it("maps all five intensity levels", () => {
    const points = ([0, 1, 2, 3, 4] as const).map((intensity, index) => ({
      date: `2026-01-0${index + 1}`,
      intensity,
    }));
    const { container } = render(<Heatmap points={points} />);
    for (const level of [0, 1, 2, 3, 4])
      expect(container.querySelector(`[data-intensity="${level}"]`)).toBeInTheDocument();
  });
  it("uses token-derived intensity styles", () => {
    expect(intensityStyle(0)).toContain("surface-2");
    expect(intensityStyle(2)).toContain("55%");
    expect(intensityStyle(4)).toContain("done");
  });
});
