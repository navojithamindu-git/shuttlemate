/** Returns duration in minutes between two HH:MM or HH:MM:SS time strings.
 *  Clamps to 0 for reversed/bad data. */
export function sessionMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/** Formats minutes into a human-readable court time string. */
export function formatCourtTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the next `count` future dates that fall on `dayOfWeek` (0=Sun, 6=Sat),
 *  starting strictly after `afterDate` (defaults to today). */
export function getNextOccurrences(
  dayOfWeek: number,
  count: number,
  afterDate?: Date
): Date[] {
  const dates: Date[] = [];
  const cursor = afterDate ? new Date(afterDate) : new Date();
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === dayOfWeek) {
      dates.push(new Date(cursor));
    }
  }
  return dates;
}

/** Returns the number of consecutive weeks (ending at the most recent past week)
 *  that have at least one session. */
export function calcStreak(sessionDates: string[], today: Date): number {
  if (sessionDates.length === 0) return 0;
  const dateSet = new Set(sessionDates);
  let streak = 0;
  const cursor = getWeekStart(today);

  for (let i = 0; i < 52; i++) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = cursor.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const hasSession = [...dateSet].some(
      (d) => d >= weekStartStr && d <= weekEndStr
    );

    if (!hasSession) {
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 7);
        continue;
      }
      break;
    }
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}
