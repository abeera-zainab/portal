import express from "express";
import pg from "pg";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "pg");
const PORT = Number(process.env.PORT || 4000);
const PG_PORT = Number(process.env.PG_PORT || 5433);

mkdirSync(dataDir, { recursive: true });

const embedded = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "pss",
  password: "pss",
  port: PG_PORT,
  persistent: true,
});

const pgConfig = {
  host: "127.0.0.1",
  port: PG_PORT,
  user: "pss",
  password: "pss",
  database: "pss_attendance",
};

async function postgresIsUp() {
  const client = new pg.Client(pgConfig);
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function startDatabase() {
  if (await postgresIsUp()) return new pg.Pool(pgConfig);
  try {
    await embedded.initialise();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!/already|exists|not empty/i.test(message) && message !== "undefined") throw error;
  }
  await embedded.start();
  try {
    await embedded.createDatabase("pss_attendance");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }
  return new pg.Pool(pgConfig);
}

const pool = await startDatabase();

await pool.query(`
  CREATE TABLE IF NOT EXISTS people (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    team TEXT,
    teams TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    joined DATE
  );

  ALTER TABLE people ADD COLUMN IF NOT EXISTS late_allowed BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS work_mode TEXT;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS officer BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS mto BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS attendance (
    user_id TEXT NOT NULL REFERENCES people(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ,
    late BOOLEAN NOT NULL DEFAULT FALSE,
    worked_minutes INTEGER,
    PRIMARY KEY (user_id, date)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES people(user_id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    rejection_reason TEXT
  );
`);

await pool.query(`UPDATE people SET mto = TRUE, role = 'employee' WHERE role = 'mto'`);

await pool.query(
  `INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined)
   VALUES ('PSS001', 'PSS Admin', 'admin', 'admin@pss.local', 'admin123', 'admin', NULL, '{}', TRUE, CURRENT_DATE)
   ON CONFLICT (user_id) DO NOTHING`
);

await pool.query(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
const bundledSeed = await pool.query(`SELECT 1 FROM app_meta WHERE key = 'bundled_seed'`);
const seedPath = path.join(__dirname, "seed.sql");
if (!bundledSeed.rowCount && existsSync(seedPath)) {
  const seedSql = readFileSync(seedPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(seedSql);
    await client.query(`INSERT INTO app_meta (key, value) VALUES ('bundled_seed', '1')`);
    await client.query("COMMIT");
    console.log("Loaded the bundled database.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const localDate = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function readState() {
  const [people, attendance, leave] = await Promise.all([
    pool.query(
      `SELECT user_id, name, username, email, role, team, teams, active, late_allowed, work_mode, officer, mto,
              to_char(joined, 'YYYY-MM-DD') AS joined
       FROM people ORDER BY user_id`
    ),
    pool.query(
      `SELECT user_id, to_char(date, 'YYYY-MM-DD') AS date, check_in, check_out, late, worked_minutes
       FROM attendance ORDER BY date DESC`
    ),
    pool.query(
      `SELECT id, user_id, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date,
              reason, status, rejection_reason
       FROM leave_requests ORDER BY from_date DESC`
    ),
  ]);

  return {
    people: people.rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      username: row.username,
      email: row.email,
      password: "",
      role: row.role,
      team: row.team,
      teams: row.teams ?? [],
      active: row.active,
      joined: row.joined || undefined,
      lateAllowed: row.late_allowed,
      officer: row.officer,
      mto: row.mto,
      workMode: row.work_mode || null,
    })),
    attendance: attendance.rows.map((row) => ({
      userId: row.user_id,
      date: row.date,
      checkIn: new Date(row.check_in).toISOString(),
      checkOut: row.check_out ? new Date(row.check_out).toISOString() : undefined,
      late: row.late,
      workedMinutes: row.worked_minutes ?? undefined,
    })),
    leave: leave.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      from: row.from_date,
      to: row.to_date,
      reason: row.reason,
      status: row.status,
      rejectionReason: row.rejection_reason || undefined,
    })),
  };
}

async function actor(req) {
  const userId = req.header("x-user-id");
  if (!userId) return null;
  const result = await pool.query(
    `SELECT user_id, role, team, teams FROM people WHERE user_id = $1 AND active = TRUE`,
    [userId]
  );
  return result.rows[0] ?? null;
}

const app = express();
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, database: "postgresql", port: PG_PORT });
});

app.get("/api/state", async (_req, res) => {
  res.json(await readState());
});

app.post("/api/login", async (req, res) => {
  const identifier = String(req.body.identifier || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const result = await pool.query(
    `SELECT user_id, name, username, email, role, team, teams, active, password,
            to_char(joined, 'YYYY-MM-DD') AS joined
     FROM people
     WHERE username = $1 OR lower(email) = $1`,
    [identifier]
  );
  const row = result.rows[0];
  if (!row || row.password !== password) {
    res.status(401).json({ error: "Incorrect username, email, or password." });
    return;
  }
  if (!row.active) {
    res.status(403).json({ error: "This account is inactive." });
    return;
  }
  res.json({
    userId: row.user_id,
    name: row.name,
    username: row.username,
    email: row.email,
    role: row.role,
    team: row.team,
    teams: row.teams ?? [],
    active: row.active,
    joined: row.joined || undefined,
  });
});

app.post("/api/attendance/check-in", async (req, res) => {
  const userId = String(req.body.userId || "");
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(9, 30, 0, 0);
  const late = now.getTime() > cutoff.getTime();
  const date = localDate(now);
  try {
    await pool.query(
      `INSERT INTO attendance (user_id, date, check_in, late) VALUES ($1, $2, $3, $4)`,
      [userId, date, now.toISOString(), late]
    );
  } catch (error) {
    if (error && error.code === "23505") {
      res.status(400).json({ error: "You already checked in today." });
      return;
    }
    throw error;
  }
  res.json({ state: await readState(), late });
});

app.post("/api/attendance/check-out", async (req, res) => {
  const userId = String(req.body.userId || "");
  const now = new Date();
  const date = localDate(now);
  const existing = await pool.query(
    `SELECT check_in, check_out FROM attendance WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );
  const row = existing.rows[0];
  if (!row) {
    res.status(400).json({ error: "Check in before you check out." });
    return;
  }
  if (row.check_out) {
    res.status(400).json({ error: "You already checked out today." });
    return;
  }
  const worked = Math.max(0, Math.round((now.getTime() - new Date(row.check_in).getTime()) / 60000));
  await pool.query(
    `UPDATE attendance SET check_out = $3, worked_minutes = $4 WHERE user_id = $1 AND date = $2`,
    [userId, date, now.toISOString(), worked]
  );
  res.json({ state: await readState() });
});

app.post("/api/people", async (req, res) => {
  const who = await actor(req);
  if (!who || who.role !== "admin") {
    res.status(403).json({ error: "Only an admin can create accounts." });
    return;
  }
  const body = req.body || {};
  const username = String(body.username || "").trim().toLowerCase().replace(/\s+/g, "");
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const role = body.role || "employee";
  if (!["admin", "team_lead", "officer", "employee"].includes(role)) {
    res.status(400).json({ error: "Choose a valid role." });
    return;
  }
  const team = role === "admin" ? null : body.team || null;
  const teams = team ? [team] : [];
  const lateAllowed = role !== "admin" && Boolean(body.lateAllowed);
  const mto = role !== "admin" && Boolean(body.mto);
  const workMode = role === "admin" ? null : body.workMode || null;
  if (workMode !== null && workMode !== "wfh" && workMode !== "remote") {
    res.status(400).json({ error: "Choose work from home, remote, or neither." });
    return;
  }
  if (!name || !username || !email || !password) {
    res.status(400).json({ error: "Name, username, email, and password are required." });
    return;
  }
  if (!/^[a-z0-9._]{3,32}$/.test(username)) {
    res.status(400).json({ error: "Username must be 3–32 letters, numbers, dots, or underscores." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }
  if (role !== "admin" && !team) {
    res.status(400).json({ error: "Choose a team." });
    return;
  }
  const numbers = await pool.query(`SELECT user_id FROM people WHERE user_id ~ '^PSS[0-9]+$'`);
  const max = numbers.rows.reduce((highest, row) => {
    const value = Number(row.user_id.slice(3));
    return value > highest ? value : highest;
  }, 0);
  const userId = String(body.userId || `PSS${String(max + 1).padStart(3, "0")}`).trim().toUpperCase();
  if (!/^PSS\d+$/.test(userId)) {
    res.status(400).json({ error: "User ID must start with PSS, for example PSS002." });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, mto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,CURRENT_DATE,$9,$10,$11)`,
      [userId, name, username, email, password, role, team, teams, lateAllowed, workMode, mto]
    );
  } catch (error) {
    if (error && error.code === "23505") {
      res.status(400).json({ error: "That user ID, username, or email is already in use." });
      return;
    }
    throw error;
  }
  res.json({ state: await readState() });
});

const accountFields = (person, body) => {
  let name = person.name;
  let email = person.email;
  let username = person.username;
  let password = person.password;
  if (body.name !== undefined) {
    name = String(body.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 2) return { error: "Enter the person's name." };
  }
  if (body.email !== undefined) {
    email = String(body.email || "").trim().toLowerCase();
    if (!email.includes("@")) return { error: "Enter a valid email." };
  }
  if (body.username !== undefined) {
    username = String(body.username || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!/^[a-z0-9._]{3,32}$/.test(username)) {
      return { error: "Username must be 3–32 letters, numbers, dots, or underscores." };
    }
  }
  if (body.password !== undefined && String(body.password).length > 0) {
    password = String(body.password);
    if (password.length < 6) return { error: "Password must be at least 6 characters." };
  }
  return { name, email, username, password };
};

app.patch("/api/people/:userId", async (req, res) => {
  const who = await actor(req);
  if (!who || (who.role !== "admin" && who.role !== "team_lead")) {
    res.status(403).json({ error: "Only an admin or team lead can edit accounts." });
    return;
  }
  const userId = req.params.userId;
  const current = await pool.query(`SELECT * FROM people WHERE user_id = $1`, [userId]);
  if (!current.rows[0]) {
    res.status(404).json({ error: "Person not found." });
    return;
  }
  const person = current.rows[0];
  if (who.role === "team_lead") {
    if (person.role === "admin") {
      res.status(403).json({ error: "A team lead cannot edit an admin." });
      return;
    }
    const leadTeams = who.teams?.length ? who.teams : who.team ? [who.team] : [];
    const memberTeams = person.teams?.length ? person.teams : person.team ? [person.team] : [];
    if (!memberTeams.some((team) => leadTeams.includes(team))) {
      res.status(403).json({ error: "You can only update people on your team." });
      return;
    }
    const active = req.body.active === undefined ? person.active : Boolean(req.body.active);
    if (active === false && who.user_id === userId) {
      res.status(400).json({ error: "You cannot deactivate the account you are using." });
      return;
    }
    const lateAllowed = req.body.lateAllowed === undefined ? person.late_allowed : Boolean(req.body.lateAllowed);
    const workMode = req.body.workMode === undefined ? person.work_mode : req.body.workMode || null;
    if (workMode !== null && workMode !== "wfh" && workMode !== "remote") {
      res.status(400).json({ error: "Choose work from home, remote, or neither." });
      return;
    }
    let role = person.role;
    if (req.body.role === "employee" && person.role === "officer") role = "employee";
    if (req.body.role === "officer" && person.role === "employee") role = "officer";
    let officer = req.body.officer === undefined ? person.officer : Boolean(req.body.officer);
    const mto = req.body.mto === undefined ? person.mto : Boolean(req.body.mto);
    if (role === "officer") officer = false;
    const account = accountFields(person, req.body || {});
    if (account.error) {
      res.status(400).json({ error: account.error });
      return;
    }
    try {
      await pool.query(
        `UPDATE people SET role = $2, active = $3, late_allowed = $4, work_mode = $5, officer = $6, mto = $7, email = $8, username = $9, password = $10, name = $11 WHERE user_id = $1`,
        [userId, role, active, lateAllowed, workMode, officer, mto, account.email, account.username, account.password, account.name]
      );
    } catch (error) {
      if (error && error.code === "23505") {
        res.status(400).json({ error: "That username or email is already in use." });
        return;
      }
      throw error;
    }
    res.json({ state: await readState() });
    return;
  }
  const role = req.body.role ?? person.role;
  if (!["admin", "team_lead", "officer", "employee"].includes(role)) {
    res.status(400).json({ error: "Choose a valid role." });
    return;
  }
  let teams = req.body.teams ?? person.teams ?? [];
  let team = req.body.team === undefined ? person.team : req.body.team;
  if (role === "admin") {
    teams = [];
    team = null;
  } else if (!teams.length && team) {
    teams = [team];
  }
  if (role !== "admin" && !teams.length) {
    res.status(400).json({ error: "A person must stay on at least one team." });
    return;
  }
  const active = req.body.active === undefined ? person.active : Boolean(req.body.active);
  if (active === false && who.user_id === userId) {
    res.status(400).json({ error: "You cannot deactivate the account you are using." });
    return;
  }
  let lateAllowed = req.body.lateAllowed === undefined ? person.late_allowed : Boolean(req.body.lateAllowed);
  let workMode = req.body.workMode === undefined ? person.work_mode : req.body.workMode || null;
  let officer = req.body.officer === undefined ? person.officer : Boolean(req.body.officer);
  let mto = req.body.mto === undefined ? person.mto : Boolean(req.body.mto);
  if (role === "admin") {
    lateAllowed = false;
    workMode = null;
    officer = false;
    mto = false;
  }
  if (role === "officer") officer = false;
  if (workMode !== null && workMode !== "wfh" && workMode !== "remote") {
    res.status(400).json({ error: "Choose work from home, remote, or neither." });
    return;
  }
  const account = accountFields(person, req.body || {});
  if (account.error) {
    res.status(400).json({ error: account.error });
    return;
  }
  try {
    await pool.query(
      `UPDATE people SET role = $2, team = $3, teams = $4, active = $5, late_allowed = $6, work_mode = $7, officer = $8, mto = $9, email = $10, username = $11, password = $12, name = $13 WHERE user_id = $1`,
      [userId, role, teams[0] ?? null, teams, active, lateAllowed, workMode, officer, mto, account.email, account.username, account.password, account.name]
    );
  } catch (error) {
    if (error && error.code === "23505") {
      res.status(400).json({ error: "That username or email is already in use." });
      return;
    }
    throw error;
  }
  res.json({ state: await readState() });
});

app.delete("/api/people/:userId", async (req, res) => {
  const who = await actor(req);
  if (!who || who.role !== "admin") {
    res.status(403).json({ error: "Only an admin can delete accounts." });
    return;
  }
  const userId = req.params.userId;
  if (who.user_id === userId) {
    res.status(400).json({ error: "You cannot delete the account you are signed in with." });
    return;
  }
  const removed = await pool.query(`DELETE FROM people WHERE user_id = $1`, [userId]);
  if (!removed.rowCount) {
    res.status(404).json({ error: "Person not found." });
    return;
  }
  res.json({ state: await readState() });
});

app.post("/api/leave", async (req, res) => {
  const { userId, from, to, reason } = req.body || {};
  if (!from || !to || !String(reason || "").trim()) {
    res.status(400).json({ error: "Enter the dates and a reason." });
    return;
  }
  if (to < from) {
    res.status(400).json({ error: "The end date cannot be before the start date." });
    return;
  }
  if (from < localDate()) {
    res.status(400).json({ error: "You cannot request leave for a past date." });
    return;
  }
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO leave_requests (id, user_id, from_date, to_date, reason, status)
     VALUES ($1,$2,$3,$4,$5,'pending')`,
    [id, userId, from, to, String(reason).trim()]
  );
  res.json({ state: await readState() });
});

app.patch("/api/account", async (req, res) => {
  const who = await actor(req);
  if (!who) {
    res.status(401).json({ error: "Sign in to update your account." });
    return;
  }
  const currentPassword = String(req.body.currentPassword || "");
  const nextEmail = req.body.email === undefined ? null : String(req.body.email || "").trim().toLowerCase();
  const nextPassword = req.body.password === undefined ? null : String(req.body.password || "");
  const current = await pool.query(`SELECT password FROM people WHERE user_id = $1`, [who.user_id]);
  if (!current.rows[0] || current.rows[0].password !== currentPassword) {
    res.status(400).json({ error: "Current password is incorrect." });
    return;
  }
  if (nextEmail !== null && !nextEmail.includes("@")) {
    res.status(400).json({ error: "Enter a valid email." });
    return;
  }
  if (nextPassword !== null && nextPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }
  if (nextEmail === null && nextPassword === null) {
    res.status(400).json({ error: "Enter a new email or password." });
    return;
  }
  try {
    await pool.query(
      `UPDATE people SET email = COALESCE($2, email), password = COALESCE($3, password) WHERE user_id = $1`,
      [who.user_id, nextEmail, nextPassword]
    );
  } catch (error) {
    if (error && error.code === "23505") {
      res.status(400).json({ error: "That email is already in use." });
      return;
    }
    throw error;
  }
  res.json({ state: await readState() });
});

app.post("/api/leave/:id/review", async (req, res) => {
  const who = await actor(req);
  if (!who || (who.role !== "admin" && who.role !== "team_lead")) {
    res.status(403).json({ error: "Only an admin or team lead can review leave." });
    return;
  }
  const decision = req.body.decision;
  const note = String(req.body.rejectionReason || "").trim();
  const existing = await pool.query(`SELECT * FROM leave_requests WHERE id = $1`, [req.params.id]);
  const request = existing.rows[0];
  if (!request) {
    res.status(404).json({ error: "Leave request not found." });
    return;
  }
  if (request.status !== "pending") {
    res.status(400).json({ error: "This request was already reviewed." });
    return;
  }
  if (request.user_id === who.user_id) {
    res.status(400).json({ error: "You cannot review your own request." });
    return;
  }
  if (who.role === "team_lead") {
    const owner = await pool.query(`SELECT role, team, teams FROM people WHERE user_id = $1`, [request.user_id]);
    const member = owner.rows[0];
    if (member?.role === "team_lead" || member?.role === "admin") {
      res.status(403).json({ error: "An admin reviews leave for team leads." });
      return;
    }
    const leadTeams = who.teams?.length ? who.teams : who.team ? [who.team] : [];
    const memberTeams = member?.teams?.length ? member.teams : member?.team ? [member.team] : [];
    if (!memberTeams.some((team) => leadTeams.includes(team))) {
      res.status(403).json({ error: "You can only review leave for your team." });
      return;
    }
  }
  if (decision === "rejected" && !note) {
    res.status(400).json({ error: "A rejection reason is required." });
    return;
  }
  await pool.query(
    `UPDATE leave_requests SET status = $2, rejection_reason = $3 WHERE id = $1`,
    [req.params.id, decision, decision === "rejected" ? note : null]
  );
  res.json({ state: await readState() });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Database error." });
});

app.listen(PORT, () => {
  console.log(`PSS API on http://localhost:${PORT}`);
  console.log(`PostgreSQL on 127.0.0.1:${PG_PORT} database pss_attendance`);
});
