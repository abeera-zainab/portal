import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import type { Person, Task, TaskActivity, TaskPriority, TaskStatus } from "../types";
import {
  assignableFor,
  canCommentOnTask,
  canDeleteTask,
  canEditTask,
  canViewTask,
  canWorkTask,
  commentOnTask,
  deleteTask,
  personTeams,
  roleTags,
  teamName,
  updateTask,
  useDatabase,
} from "../store";
import { statusLabel } from "./taskStats";
import { BackLink, DueDate, PriorityBadge, PrioritySelect, StatusBadge, StatusSelect, formatDay, formatWhen } from "./TaskUi";

export function TaskDetail({ person, backTo = "/tasks/list" }: { person: Person; backTo?: string }) {
  const { taskId = "" } = useParams();
  const db = useDatabase();
  const task = db.tasks.find((item) => item.id === taskId);
  if (!task || !canViewTask(person, task, db.people)) return <Navigate to={backTo} replace />;
  return <TaskDetailBody key={task.id} task={task} person={person} backTo={backTo} />;
}

function TaskDetailBody({ task, person, backTo }: { task: Task; person: Person; backTo: string }) {
  const db = useDatabase();
  const navigate = useNavigate();
  const assignee = db.people.find((item) => item.userId === task.assigneeUserId);
  const creator = db.people.find((item) => item.userId === task.createdBy);
  const editor = canEditTask(person, task);
  const worker = canWorkTask(person, task);
  const commenter = canCommentOnTask(person, task, db.people);
  const remover = canDeleteTask(person, task);
  const comments = db.taskComments.filter((item) => item.taskId === task.id);
  const activity = db.taskActivity.filter((item) => item.taskId === task.id);
  const nameOf = (userId: string) => db.people.find((item) => item.userId === userId)?.name ?? "Former member";

  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [brief, setBrief] = useState(task.brief);
  const [assigneeUserId, setAssigneeUserId] = useState(task.assigneeUserId);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setStatus(task.status);
  }, [task.status]);

  useEffect(() => {
    if (!worker) setDescription(task.description);
  }, [task.description, worker]);

  const run = async (action: () => Promise<void>, done: string) => {
    try {
      setError("");
      await action();
      setSaved(done);
    } catch (err) {
      setSaved("");
      setError(err instanceof Error ? err.message : "Could not update the task.");
    }
  };

  const saveWork = (event: FormEvent) => {
    event.preventDefault();
    void run(() => updateTask(task.id, { description, status }), "Progress saved.");
  };

  const changeStatus = (next: TaskStatus) => {
    setStatus(next);
    void run(() => updateTask(task.id, { status: next }), `Marked ${statusLabel(next).toLowerCase()}.`);
  };

  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await updateTask(task.id, { title, brief, assigneeUserId, priority, dueDate: dueDate || null });
      setEditing(false);
    }, "Task updated.");
  };

  const sendComment = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await commentOnTask(task.id, comment);
      setComment("");
    }, "");
  };

  const remove = () => {
    if (!window.confirm("Delete this task? Comments and history go with it.")) return;
    void run(async () => {
      await deleteTask(task.id);
      navigate(backTo);
    }, "");
  };

  const assignable = assignableFor(person, db.people);

  return (
    <div className="manage">
      <BackLink to={backTo}>← Back</BackLink>

      <section className="card">
        <div className="task-head">
          <div>
            <h1>{task.title}</h1>
            <div className="role-tags">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {assignee
                ? personTeams(assignee).map((team) => (
                    <span key={team} className="badge team">
                      {teamName(team)}
                    </span>
                  ))
                : null}
            </div>
          </div>
          <div className="filters">
            {editor ? (
              <button type="button" className={editing ? "btn secondary" : "btn"} onClick={() => setEditing((current) => !current)}>
                {editing ? "Close editor" : "Edit task"}
              </button>
            ) : null}
            {remover ? (
              <button type="button" className="btn danger" onClick={remove}>
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <dl className="profile-facts task-facts">
          <div>
            <dt>Assignee</dt>
            <dd>
              {assignee ? (
                person.role === "admin" ? (
                  <Link className="name-btn" to={`/users/${assignee.userId}`}>
                    {assignee.name}
                  </Link>
                ) : (
                  assignee.name
                )
              ) : (
                "Former member"
              )}
            </dd>
          </div>
          <div>
            <dt>Assigned by</dt>
            <dd>{creator?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>
              <DueDate task={task} />
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatWhen(task.createdAt)}</dd>
          </div>
          <div>
            <dt>Last update</dt>
            <dd>{formatWhen(task.updatedAt)}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{task.completedAt ? formatWhen(task.completedAt) : "—"}</dd>
          </div>
        </dl>

        {task.brief ? (
          <div className="task-brief-box">
            <strong>Assignment note</strong>
            <p className="task-copy">{task.brief}</p>
          </div>
        ) : null}

        {editing && editor ? (
          <form onSubmit={saveEdit} className="task-grid" style={{ marginTop: 18 }}>
            <label className="span-2">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label>
              Assign to
              <select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)} required>
                {assignable.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.name}
                  </option>
                ))}
                {assignable.some((item) => item.userId === assigneeUserId) ? null : (
                  <option value={assigneeUserId}>{assignee?.name ?? "Former member"}</option>
                )}
              </select>
            </label>
            <label>
              Priority
              <PrioritySelect value={priority} onChange={setPriority} />
            </label>
            <label>
              Due date
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              Status
              <StatusSelect value={status} onChange={setStatus} />
            </label>
            <label className="span-2">
              Assignment note
              <textarea value={brief} onChange={(event) => setBrief(event.target.value)} />
            </label>
            <div className="row span-2">
              <button className="btn" type="submit">
                Save task
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <div className="grid-2 task-columns">
        <section className="card">
          <h2>Description</h2>
          {worker ? (
            <form onSubmit={saveWork}>
              <p className="muted">Write what you did and where it stands. Update the status when it changes.</p>
              <label style={{ marginTop: 12 }}>
                Progress and notes
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  style={{ minHeight: 160 }}
                  placeholder="What you have done so far, blockers, and what is left."
                />
              </label>
              <div className="row" style={{ marginTop: 12 }}>
                <label>
                  Status
                  <StatusSelect value={status} onChange={setStatus} />
                </label>
                <button className="btn" type="submit">
                  Save progress
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="task-copy">{task.description || "No description yet."}</p>
              {editor && !editing ? (
                <div className="row" style={{ marginTop: 14 }}>
                  <label>
                    Status
                    <StatusSelect value={status} onChange={changeStatus} />
                  </label>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="card">
          <h2>Activity</h2>
          {activity.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <ul className="task-timeline">
              {[...activity].reverse().map((item) => (
                <li key={item.id}>
                  <span className="task-timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{activityText(item, nameOf)}</strong>
                    <small>
                      {nameOf(item.actorUserId)} · {formatWhen(item.createdAt)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Comments</h2>
        <p className="muted">
          {commenter
            ? "Discuss the task here. Everyone who can see the task can read the thread."
            : "Only the assignee, the person who assigned it, and leads of this team can comment."}
        </p>
        {comments.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>No comments yet.</p> : null}
        <div className="task-thread">
          {comments.map((item) => {
            const author = db.people.find((entry) => entry.userId === item.authorUserId);
            const role = author ? (author.role === "admin" ? "Admin" : roleTags(author).map((tag) => tag.label).join(" · ")) : "";
            return (
              <div key={item.id} className={item.authorUserId === person.userId ? "task-comment mine" : "task-comment"}>
                <div className="task-comment-head">
                  <strong>{author?.name ?? "Former member"}</strong>
                  {role ? <span className="badge team">{role}</span> : null}
                  <span className="muted">{formatWhen(item.createdAt)}</span>
                </div>
                <p className="task-copy">{item.body}</p>
              </div>
            );
          })}
        </div>
        {commenter ? (
          <form onSubmit={sendComment} style={{ marginTop: 14 }}>
            <label>
              Add a comment
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} required />
            </label>
            <button className="btn" type="submit" style={{ marginTop: 12 }}>
              Post comment
            </button>
          </form>
        ) : null}
      </section>

      {saved ? <p className="muted">{saved}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function activityText(item: TaskActivity, nameOf: (userId: string) => string) {
  switch (item.kind) {
    case "created":
      return item.detail ? `Task created · ${item.detail}` : "Task created";
    case "status":
      return `Status changed to ${item.detail}`;
    case "reassigned":
      return `Reassigned to ${item.detail}`;
    case "priority":
      return `Priority set to ${item.detail}`;
    case "due":
      return item.detail ? `Due date set to ${formatDay(item.detail)}` : "Due date removed";
    case "edited":
      return "Title or assignment note edited";
    case "description":
      return "Description updated";
    case "comment":
      return `Comment from ${nameOf(item.actorUserId)}`;
    default:
      return item.detail || "Updated";
  }
}
