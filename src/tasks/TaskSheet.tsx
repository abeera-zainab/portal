import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { Person, Task, TaskComment, TaskCommentKind, TaskStatus, TaskTeam } from "../types";
import {
  TEAMS,
  addSheetDay,
  canAddSheetDay,
  canEditTask,
  canWorkTask,
  canWriteTaskCell,
  saveTaskCell,
  taskTeam,
  taskTeamLabel,
  todayKey,
  updateTask,
  useDatabase,
} from "../store";
import { sortTasks } from "./taskStats";
import { DueDate, StatusBadge, StatusSelect, formatDay } from "./TaskUi";

const FIXED_COLUMNS = 4;

type SheetRow = {
  task: Task;
  assignee: Person | undefined;
  teamSpan: number;
  ownerSpan: number;
  serial: number;
  teamId: string;
};

const shortDay = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Team a task is filed under on the sheet: the one picked on the task, else the assignee's first team. */
const sheetTeam = (task: Task, assignee: Person | undefined) => taskTeam(task, assignee) ?? "none";

/** Groups tasks by team then owner and works out the merged-cell spans, like the spreadsheet. */
export const buildSheetRows = (tasks: Task[], people: Person[], taskTeams: TaskTeam[] = []): SheetRow[] => {
  const catalog = taskTeams.length ? taskTeams : TEAMS;
  const order = new Map<string, number>(catalog.map((team, index) => [team.id, index]));
  order.set("none", catalog.length);
  const decorated = sortTasks(tasks).map((task) => {
    const assignee = people.find((item) => item.userId === task.assigneeUserId);
    return { task, assignee, teamId: sheetTeam(task, assignee), ownerName: assignee?.name ?? "Former member" };
  });
  decorated.sort((left, right) => {
    const team = (order.get(left.teamId) ?? 99) - (order.get(right.teamId) ?? 99);
    if (team !== 0) return team;
    const owner = left.ownerName.localeCompare(right.ownerName);
    if (owner !== 0) return owner;
    return 0;
  });

  const rows: SheetRow[] = [];
  let serial = 0;
  for (let index = 0; index < decorated.length; index += 1) {
    const current = decorated[index];
    const previous = decorated[index - 1];
    const newTeam = !previous || previous.teamId !== current.teamId;
    const newOwner = newTeam || previous.task.assigneeUserId !== current.task.assigneeUserId;
    if (newOwner) serial += 1;

    let teamSpan = 0;
    if (newTeam) {
      teamSpan = 1;
      while (decorated[index + teamSpan] && decorated[index + teamSpan].teamId === current.teamId) teamSpan += 1;
    }
    let ownerSpan = 0;
    if (newOwner) {
      ownerSpan = 1;
      while (
        decorated[index + ownerSpan] &&
        decorated[index + ownerSpan].teamId === current.teamId &&
        decorated[index + ownerSpan].task.assigneeUserId === current.task.assigneeUserId
      ) {
        ownerSpan += 1;
      }
    }
    rows.push({ task: current.task, assignee: current.assignee, teamSpan, ownerSpan, serial, teamId: current.teamId });
  }
  return rows;
};

export function TaskSheet({ rows, person }: { rows: SheetRow[]; person: Person }) {
  const db = useDatabase();
  const today = todayKey();
  // Columns opened with the + button that nobody has written in yet.
  const [picking, setPicking] = useState(false);
  const [pickedDay, setPickedDay] = useState(today);
  const [addError, setAddError] = useState("");

  const cells = useMemo(() => {
    const map = new Map<string, TaskComment[]>();
    const ids = new Set(rows.map((row) => row.task.id));
    for (const comment of db.taskComments) {
      if (!ids.has(comment.taskId)) continue;
      const key = `${comment.taskId}|${comment.day}|${comment.kind}`;
      const list = map.get(key) ?? [];
      list.push(comment);
      map.set(key, list);
    }
    return map;
  }, [db.taskComments, rows]);

  // Columns: every date the admin opened, plus any date someone has already written on.
  const days = useMemo(() => {
    const set = new Set<string>(db.sheetDays);
    const ids = new Set(rows.map((row) => row.task.id));
    for (const comment of db.taskComments) if (ids.has(comment.taskId)) set.add(comment.day);
    return [...set].sort();
  }, [db.taskComments, db.sheetDays, rows]);

  const adminHere = canAddSheetDay(person);
  const columns = FIXED_COLUMNS + days.length * 2 + (adminHere ? 1 : 0);

  const changeStatus = async (task: Task, status: TaskStatus) => {
    try {
      await updateTask(task.id, { status });
    } catch {
      /* the badge simply keeps the previous value */
    }
  };

  const addDay = async () => {
    setAddError("");
    if (!pickedDay) {
      setAddError("Pick a date.");
      return;
    }
    if (days.includes(pickedDay)) {
      setPicking(false);
      return;
    }
    try {
      await addSheetDay(pickedDay);
      setPicking(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add the column.");
    }
  };

  return (
    <>
      <div className="task-sheet">
        <table>
          <thead>
            <tr className="sheet-band">
              <th rowSpan={2} className="sheet-sn">
                S.N
              </th>
              <th rowSpan={2} className="sheet-team">
                Team
              </th>
              <th rowSpan={2} className="sheet-owner">
                Owner
              </th>
              <th rowSpan={2} className="sheet-item">
                Items
              </th>
              {days.map((day, index) => (
                <th key={day} colSpan={2} className={`sheet-group sheet-group-start${day === today ? " today" : ""}`}>
                  <span className="sheet-group-step">{index === 0 ? "Round 1" : `Round ${index + 1}`}</span>
                  {formatDay(day)}
                  {day === today ? <span className="sheet-group-today">Today</span> : null}
                </th>
              ))}
              {adminHere ? (
                <th rowSpan={2} className="sheet-add sheet-group-start">
                  {picking ? (
                    <div className="sheet-add-form">
                      <input
                        type="date"
                        value={pickedDay}
                        max={today}
                        aria-label="Review date for the new column"
                        onChange={(event) => setPickedDay(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void addDay();
                          if (event.key === "Escape") setPicking(false);
                        }}
                        autoFocus
                      />
                      <button type="button" className="btn" onClick={() => void addDay()}>
                        Add
                      </button>
                      <button type="button" className="btn secondary" onClick={() => setPicking(false)}>
                        Cancel
                      </button>
                      {addError ? <small className="sheet-note error">{addError}</small> : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="sheet-add-btn"
                      title="Add a date column (today or a previous date)"
                      aria-label="Add a date column"
                      onClick={() => {
                        setPickedDay(today);
                        setPicking(true);
                      }}
                    >
                      +
                    </button>
                  )}
                </th>
              ) : null}
            </tr>
            <tr className="sheet-subrow">
              {days.map((day, index) => (
                <SheetHeads key={day} day={day} today={today} first={index === 0} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns}>No tasks match this view.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const { task, assignee } = row;
                const statusEditor = canWorkTask(person, task) || canEditTask(person, task);
                return (
                  <tr key={task.id} className={task.status === "done" ? "sheet-row done" : "sheet-row"}>
                    {row.ownerSpan ? (
                      <td rowSpan={row.ownerSpan} className="sheet-sn sheet-merged">
                        {row.serial}
                      </td>
                    ) : null}
                    {row.teamSpan ? (
                      <td rowSpan={row.teamSpan} className="sheet-team sheet-merged">
                        {row.teamId === "none" ? "—" : taskTeamLabel(row.teamId, db.taskTeams)}
                      </td>
                    ) : null}
                    {row.ownerSpan ? (
                      <td rowSpan={row.ownerSpan} className="sheet-owner sheet-merged">
                        {assignee?.name ?? "Former member"}
                      </td>
                    ) : null}
                    <td className="sheet-item">
                      <Link className="name-btn" to={`/tasks/${task.id}`}>
                        {task.title}
                      </Link>
                      {task.brief ? <small className="task-brief">{task.brief}</small> : null}
                      <div className="sheet-meta">
                        <DueDate task={task} />
                      </div>
                      <div className="sheet-meta">
                        {statusEditor ? (
                          <StatusSelect value={task.status} onChange={(status) => changeStatus(task, status)} />
                        ) : (
                          <StatusBadge status={task.status} />
                        )}
                      </div>
                    </td>
                    {days.map((day) => (
                      <SheetDayCells
                        key={day}
                        task={task}
                        day={day}
                        today={today}
                        person={person}
                        people={db.people}
                        responses={cells.get(`${task.id}|${day}|response`) ?? []}
                        comments={cells.get(`${task.id}|${day}|comment`) ?? []}
                      />
                    ))}
                    {adminHere ? <td className="sheet-add sheet-group-start" /> : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Column roles under one review date, worded like the status-tracker spreadsheet. */
function SheetHeads({ day, today, first }: { day: string; today: string; first: boolean }) {
  const className = day === today ? "sheet-sub today" : "sheet-sub";
  const label = first ? "Response by Task Owner" : "Status by Task Owner";
  return (
    <>
      <th className={`${className} sheet-group-start`}>
        {label} <span className="sheet-sub-date">({shortDay(day)})</span>
      </th>
      <th className={className}>Comments by CISO</th>
    </>
  );
}

function SheetDayCells({
  task,
  day,
  today,
  person,
  people,
  responses,
  comments,
}: {
  task: Task;
  day: string;
  today: string;
  person: Person;
  people: Person[];
  responses: TaskComment[];
  comments: TaskComment[];
}) {
  const ownResponse = [...responses].reverse().find((item) => item.authorUserId === person.userId);
  const ownComment = [...comments].reverse().find((item) => item.authorUserId === person.userId);
  const closed = task.status === "done";
  const className = day === today ? "sheet-cell-wrap today" : "sheet-cell-wrap";
  return (
    <>
      <td className={`${className} sheet-group-start`}>
        <SheetCell
          task={task}
          day={day}
          kind="response"
          entries={responses}
          own={ownResponse}
          people={people}
          person={person}
          editable={!closed && canWriteTaskCell(person, task, "response", day, people, ownResponse)}
          closed={closed}
          placeholder={day === today ? "Write your update…" : ""}
        />
      </td>
      <td className={className}>
        <SheetCell
          task={task}
          day={day}
          kind="comment"
          entries={comments}
          own={ownComment}
          people={people}
          person={person}
          editable={!closed && canWriteTaskCell(person, task, "comment", day, people, ownComment)}
          closed={closed}
          placeholder="Add a comment…"
        />
      </td>
    </>
  );
}

function SheetCell({
  task,
  day,
  kind,
  entries,
  own,
  people,
  person,
  editable,
  closed,
  placeholder,
}: {
  task: Task;
  day: string;
  kind: TaskCommentKind;
  entries: TaskComment[];
  own: TaskComment | undefined;
  people: Person[];
  person: Person;
  editable: boolean;
  closed: boolean;
  placeholder: string;
}) {
  const others = entries.filter((item) => item.authorUserId !== person.userId);
  const saved = own?.body ?? "";
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);

  // Keep the draft in step with the server unless the user is mid-edit.
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(saved);
  }, [saved]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.max(node.scrollHeight, 40)}px`;
  }, [draft, editable]);

  const save = async () => {
    if (inFlight.current) return;
    const text = draft.trim();
    if (text === saved.trim()) {
      setDraft(saved);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await saveTaskCell(task.id, { day, kind, body: text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setDraft(saved);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      setDraft(saved);
      event.currentTarget.blur();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.blur();
      void save();
    }
  };

  const nameOf = (userId: string) => people.find((item) => item.userId === userId)?.name ?? "Former member";
  // The owner column already names who wrote a response; comments need a byline.
  const showNames = kind === "comment";

  return (
    <div className="sheet-cell">
      {others.map((item) => (
        <p key={item.id} className="sheet-entry readonly">
          {showNames ? <span className="sheet-author">{nameOf(item.authorUserId)}</span> : null}
          {item.body}
        </p>
      ))}
      {editable ? (
        <>
          <textarea
            ref={ref}
            className={saving ? "sheet-input saving" : "sheet-input"}
            value={draft}
            placeholder={placeholder}
            rows={1}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            onKeyDown={onKeyDown}
            aria-label={`${kind === "response" ? "Response" : "Comment"} for ${task.title} on ${formatDay(day)}`}
          />
          {saving ? <small className="sheet-note">Saving…</small> : null}
          {error ? <small className="sheet-note error">{error}</small> : null}
        </>
      ) : own ? (
        <p className="sheet-entry readonly">{own.body}</p>
      ) : others.length === 0 ? (
        closed ? (
          <span className="sheet-closed">Task closed</span>
        ) : (
          <span className="sheet-empty">—</span>
        )
      ) : null}
    </div>
  );
}
