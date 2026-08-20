// TARGET PATH: lib/ist-week.ts

// Returns this week's Monday as "YYYY-MM-DD" in Asia/Kolkata time — matches
// weekly_challenges.week_start_date and the IST week boundary used by
// get_candidate_streak() on the SQL side. Kept here rather than duplicated
// inline since both weekly-challenge routes need the same value to agree
// on "which week is this."
export function getISTWeekStartDate(): string {
  const now = new Date();
  // toLocaleString with a timeZone gives us IST wall-clock time without
  // pulling in a date library — good enough for a once-a-week boundary calc.
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);

  const day = istDate.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(istDate);
  monday.setDate(istDate.getDate() - diffToMonday);

  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}