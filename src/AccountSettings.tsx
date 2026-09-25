import { useState } from "react";
import type { FormEvent } from "react";
import type { Person } from "./types";
import { updateAccount } from "./store";

export function AccountSettings({ person }: { person: Person }) {
  const [email, setEmail] = useState(person.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved("");
    if (password && password !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    try {
      setError("");
      await updateAccount({
        currentPassword,
        email: email.trim().toLowerCase() === person.email ? undefined : email,
        password: password || undefined,
      });
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setSaved("Your account was updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your account.");
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Your account</h2>
      <p className="muted">Change your email or password. Enter your current password to save.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave blank to keep it"
          />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        <button className="btn" type="submit">
          Save
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p className="muted">{saved}</p> : null}
    </form>
  );
}
