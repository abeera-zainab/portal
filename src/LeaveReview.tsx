import { useState } from "react";
import type { LeaveRequest } from "./types";
import { reviewLeave, useDatabase, useSession } from "./store";

export function LeaveInbox({
  requests,
  reviewerId,
  title,
}: {
  requests: LeaveRequest[];
  reviewerId: string;
  title: string;
}) {
  const db = useDatabase();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const review = async (id: string, decision: "approved" | "rejected") => {
    try {
      await reviewLeave(id, reviewerId, decision, notes[id]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this request.");
    }
  };

  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">A rejection needs a reason. That reason is what the employee sees.</p>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Dates</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={5}>No leave requests.</td>
            </tr>
          ) : (
            requests.map((request) => {
              const owner = db.people.find((person) => person.userId === request.userId);
              return (
                <tr key={request.id}>
                  <td>
                    {owner?.name ?? request.userId}
                    <div className="muted">{owner?.userId}</div>
                  </td>
                  <td>
                    {request.from}
                    {request.to !== request.from ? ` → ${request.to}` : ""}
                  </td>
                  <td>{request.reason}</td>
                  <td>
                    <span
                      className={
                        request.status === "approved" ? "badge" : request.status === "rejected" ? "badge no" : "badge wait"
                      }
                    >
                      {request.status}
                    </span>
                  </td>
                  <td>
                    {request.status === "pending" && request.userId !== reviewerId ? (
                      <div className="row">
                        <input
                          placeholder="Rejection reason"
                          value={notes[request.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                          }
                        />
                        <button className="btn" onClick={() => review(request.id, "approved")}>
                          Approve
                        </button>
                        <button className="btn danger" onClick={() => review(request.id, "rejected")}>
                          Reject
                        </button>
                      </div>
                    ) : request.status === "rejected" ? (
                      request.rejectionReason
                    ) : request.userId === reviewerId ? (
                      "Your request"
                    ) : (
                      "Approved"
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

export function LeavePage() {
  const db = useDatabase();
  const session = useSession();
  const accepted = db.leave.filter((request) => request.status === "approved").length;
  const rejected = db.leave.filter((request) => request.status === "rejected").length;
  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Leave</h1>
          <p className="muted">Accepted and rejected requests are counted here.</p>
        </div>
      </div>
      <div className="dash-stats">
        <article className="card stat">
          <span>Total leaves</span>
          <strong>{db.leave.length}</strong>
        </article>
        <article className="card stat">
          <span>Accepted</span>
          <strong className="tone-green">{accepted}</strong>
        </article>
        <article className="card stat">
          <span>Rejected</span>
          <strong className="tone-amber">{rejected}</strong>
        </article>
      </div>
      <LeaveInbox requests={db.leave} reviewerId={session?.userId ?? ""} title="Leave requests" />
    </section>
  );
}
