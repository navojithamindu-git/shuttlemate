import { describe, it, expect } from "vitest";
import { sessionMinutes, formatCourtTime, calcStreak, getNextOccurrences } from "../session-utils";

// ─── sessionMinutes ───────────────────────────────────────────────────────────

describe("sessionMinutes", () => {
  it("calculates duration for a normal session", () => {
    expect(sessionMinutes("21:00", "23:00")).toBe(120);
  });

  it("handles HH:MM:SS format from Supabase", () => {
    expect(sessionMinutes("18:00:00", "20:00:00")).toBe(120);
  });

  it("returns 0 for reversed times (bad data)", () => {
    expect(sessionMinutes("21:00", "11:00")).toBe(0);
  });

  it("returns 0 for equal times", () => {
    expect(sessionMinutes("18:00", "18:00")).toBe(0);
  });

  it("handles sessions that cross the hour boundary", () => {
    expect(sessionMinutes("17:30", "19:15")).toBe(105);
  });
});

// ─── formatCourtTime ─────────────────────────────────────────────────────────

describe("formatCourtTime", () => {
  it("shows minutes when under 1 hour", () => {
    expect(formatCourtTime(45)).toBe("45min");
  });

  it("shows whole hours when no remainder", () => {
    expect(formatCourtTime(120)).toBe("2h");
  });

  it("shows hours and minutes when there is a remainder", () => {
    expect(formatCourtTime(150)).toBe("2h 30min");
  });

  it("shows 0min for zero", () => {
    expect(formatCourtTime(0)).toBe("0min");
  });
});

// ─── calcStreak ───────────────────────────────────────────────────────────────

describe("calcStreak", () => {
  it("returns 0 for no sessions", () => {
    expect(calcStreak([], new Date("2026-03-12"))).toBe(0);
  });

  it("returns 1 for a session only last week", () => {
    // Today: Thursday March 12. Last week: March 2-8.
    expect(calcStreak(["2026-03-06"], new Date("2026-03-12"))).toBe(1);
  });

  it("returns 1 when only current week has a session", () => {
    expect(calcStreak(["2026-03-11"], new Date("2026-03-12"))).toBe(1);
  });

  it("returns 2 for sessions in both current and last week", () => {
    expect(
      calcStreak(["2026-03-11", "2026-03-06"], new Date("2026-03-12"))
    ).toBe(2);
  });

  it("does not break streak if current week has no sessions yet", () => {
    // Current week (Mar 9-15) has no session, but last 2 weeks do
    expect(
      calcStreak(["2026-03-06", "2026-02-27"], new Date("2026-03-12"))
    ).toBe(2);
  });

  it("breaks streak on a missing week", () => {
    // Sessions 4 weeks ago and 2 weeks ago — gap in between
    expect(
      calcStreak(["2026-02-20", "2026-03-06"], new Date("2026-03-12"))
    ).toBe(1);
  });

  it("handles duplicate dates gracefully", () => {
    expect(
      calcStreak(["2026-03-11", "2026-03-11", "2026-03-06"], new Date("2026-03-12"))
    ).toBe(2);
  });
});

// ─── getNextOccurrences ───────────────────────────────────────────────────────

describe("getNextOccurrences", () => {
  it("returns the correct number of dates", () => {
    const dates = getNextOccurrences(5, 4); // Friday
    expect(dates).toHaveLength(4);
  });

  it("all returned dates fall on the requested day of week", () => {
    const dates = getNextOccurrences(5, 4); // 5 = Friday
    dates.forEach((d) => {
      expect(d.getDay()).toBe(5);
    });
  });

  it("generates Saturdays correctly", () => {
    const dates = getNextOccurrences(6, 2); // 6 = Saturday
    dates.forEach((d) => {
      expect(d.getDay()).toBe(6);
    });
  });

  it("generates dates strictly after the afterDate", () => {
    const after = new Date("2026-03-12T00:00:00"); // Thursday
    const dates = getNextOccurrences(5, 2, after); // Next 2 Fridays
    dates.forEach((d) => {
      expect(d > after).toBe(true);
    });
  });

  it("the timezone bug is fixed — stored date string matches day of week", () => {
    // This was the bug: toISOString() shifted dates back in UTC+5:30
    // getNextOccurrences now uses local date parts, so dateStr must match getDay()
    const after = new Date("2026-03-12T00:00:00");
    const dates = getNextOccurrences(5, 1, after); // next Friday
    const d = dates[0];
    // Build the date string the same way groups.ts does after the fix
    const dateStr = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    const parsed = new Date(dateStr + "T00:00:00");
    expect(parsed.getDay()).toBe(5); // must be Friday
  });
});
