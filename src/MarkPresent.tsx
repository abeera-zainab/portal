import { useState } from "react";
import type { DayStatus } from "./store";
import { canMarkPresent, isWeekend, markPresent, todayKey, useSession } from "./store";

export function MarkPresentButton({
  userId,
  date,
  status,
  marked = false,
}: {
  userId: string;
  date: string;
  status: DayStatus | null;
  marked?: boolean;
}) {
  const session = useSession();
  const [error, setError] = useState("");
  if (!session || !canMarkPresent(session) || !date || date > todayKey() || isWeekend(date)) return null;
  const editable = status === "not_in" || status === "late" || status === "leave" || status === "absentee";
  if (!editable && !marked) return null;

  const run = async (present: boolean) => {
    try {
      setError("");
      await markPresent(userId, date, present);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this status.");
    }
  };

  return (
    <span className="mark-present">
      <button type="button" className="text-btn" onClick={() => void run(!marked)}>
        {marked ? "Undo" : "Mark present"}
      </button>
      {error ? <span className="error"> {error}</span> : null}
    </span>
  );
}
