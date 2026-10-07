import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { Person, TaskPriority } from "../types";
import { assignableFor, canAssignTasks, createTask, personTeams, teamName, todayKey, useDatabase } from "../store";
import { BackLink, PrioritySelect } from "./TaskUi";

export function TaskForm({ person }: { person: Person }) {
  const db = useDatabase();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const people = assignableFor(person, db.people);
  const preset = params.get("person") || "";
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState(people.some((item) => item.userId === preset) ? preset : "");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!canAssignTasks(person)) return <Navigate to="/tasks" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createTask({ title, brief, assigneeUserId, priority, dueDate: dueDate || undefined });
      navigate("/tasks/list?view=assigned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manage">
      <BackLink to="/tasks">← Back</BackLink>
      <div className="manage-head">
        <div>
          <h1>New task</h1>
          <p className="muted">
            {person.role === "admin"
              ? "Assign a task to anyone. They write the description and update progress."
              : `You can assign tasks to people on ${personTeams(person).map((team) => teamName(team)).join(" or ") || "your team"}.`}
          </p>
        </div>
      </div>
      <section className="card">
        <form onSubmit={submit} className="task-grid">
          <label className="span-2">
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus />
          </label>
          <label>
            Assign to
            <select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)} required>
              <option value="">Choose a person</option>
              {people.map((item) => (
                <option key={item.userId} value={item.userId}>
                  {item.name}
                  {person.role === "admin" ? ` · ${personTeams(item).map((team) => teamName(team)).join(", ") || "No team"}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <PrioritySelect value={priority} onChange={setPriority} />
          </label>
          <label>
            Due date
            <input type="date" min={todayKey()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label className="span-2">
            Assignment note
            <textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="What needs to be done, and anything the assignee should know."
            />
          </label>
          <div className="row span-2">
            <button className="btn" type="submit" disabled={saving}>
              Add task
            </button>
            <Link className="btn secondary" to="/tasks/list">
              Cancel
            </Link>
          </div>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}
