import pg from "pg";
import { writeFileSync } from "node:fs";

const client = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  user: "pss",
  password: "pss",
  database: "pss_attendance",
});

await client.connect();

const lit = (value) => (value === null || value === undefined ? "NULL" : client.escapeLiteral(String(value)));
const bool = (value) => (value ? "TRUE" : "FALSE");
const textArray = (value) => {
  const items = Array.isArray(value) ? value : [];
  if (!items.length) return "ARRAY[]::text[]";
  return `ARRAY[${items.map((item) => client.escapeLiteral(String(item))).join(", ")}]::text[]`;
};

const people = await client.query(
  `SELECT user_id, name, username, email, password, role, team, teams, active, late_allowed, work_mode, officer, mto,
          to_char(joined, 'YYYY-MM-DD') AS joined
   FROM people ORDER BY user_id`
);
const attendance = await client.query(
  `SELECT user_id, to_char(date, 'YYYY-MM-DD') AS date, check_in, check_out, late, worked_minutes
   FROM attendance ORDER BY user_id, date`
);
const leave = await client.query(
  `SELECT id, user_id, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date,
          reason, status, rejection_reason
   FROM leave_requests ORDER BY from_date`
);

const lines = ["-- Bundled attendance database. Loaded once on a new install."];
for (const row of people.rows) {
  lines.push(`INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES (${lit(row.user_id)}, ${lit(row.name)}, ${lit(row.username)}, ${lit(row.email)}, ${lit(row.password)}, ${lit(row.role)}, ${row.team ? lit(row.team) : "NULL"}, ${textArray(row.teams)}, ${bool(row.active)}, ${row.joined ? lit(row.joined) : "NULL"}, ${bool(row.late_allowed)}, ${row.work_mode ? lit(row.work_mode) : "NULL"}, ${bool(row.officer)}, ${bool(row.mto)})
ON CONFLICT (user_id) DO UPDATE SET
  name = EXCLUDED.name,
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  team = EXCLUDED.team,
  teams = EXCLUDED.teams,
  active = EXCLUDED.active,
  joined = EXCLUDED.joined,
  late_allowed = EXCLUDED.late_allowed,
  work_mode = EXCLUDED.work_mode,
  officer = EXCLUDED.officer,
  mto = EXCLUDED.mto;`);
}
for (const row of attendance.rows) {
  lines.push(`INSERT INTO attendance (user_id, date, check_in, check_out, late, worked_minutes)
VALUES (${lit(row.user_id)}, ${lit(row.date)}, ${lit(new Date(row.check_in).toISOString())}::timestamptz, ${row.check_out ? `${lit(new Date(row.check_out).toISOString())}::timestamptz` : "NULL"}, ${bool(row.late)}, ${row.worked_minutes ?? "NULL"})
ON CONFLICT (user_id, date) DO NOTHING;`);
}
for (const row of leave.rows) {
  lines.push(`INSERT INTO leave_requests (id, user_id, from_date, to_date, reason, status, rejection_reason)
VALUES (${lit(row.id)}, ${lit(row.user_id)}, ${lit(row.from_date)}, ${lit(row.to_date)}, ${lit(row.reason)}, ${lit(row.status)}, ${row.rejection_reason ? lit(row.rejection_reason) : "NULL"})
ON CONFLICT (id) DO NOTHING;`);
}

const sql = `${lines.join("\n\n")}\n`;
writeFileSync(new URL("./seed.sql", import.meta.url), sql);
console.log(`people ${people.rows.length}, attendance ${attendance.rows.length}, leave ${leave.rows.length}`);
await client.end();
