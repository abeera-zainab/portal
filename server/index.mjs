import express from "express";
import pg from "pg";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", process.env.PG_DATA || "pg");
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
  const client = new pg.Client({ ...pgConfig, connectionTimeoutMillis: 2000 });
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
  ALTER TABLE people ADD COLUMN IF NOT EXISTS reports_to TEXT REFERENCES people(user_id) ON DELETE SET NULL;

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

await pool.query(
  `INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined)
   VALUES ('HR001', 'HR', 'hr', 'hr@pss.local', 'hr123456', 'hr', NULL, '{}', TRUE, CURRENT_DATE)
   ON CONFLICT (user_id) DO NOTHING`
);

await pool.query(
  `INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined)
   VALUES ('HR002', 'HR PSS', 'hr-pss', 'hr-pss@pss.local', 'hr123456', 'hr', NULL, '{}', TRUE, CURRENT_DATE)
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
              reports_to, to_char(joined, 'YYYY-MM-DD') AS joined
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
      reportsTo: row.reports_to || undefined,
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
    `SELECT user_id, username, role, team, teams, officer, mto FROM people WHERE user_id = $1 AND active = TRUE`,
    [userId]
  );
  return result.rows[0] ?? null;
}

const isHrPss = (row) => Boolean(row) && row.role === "hr" && String(row.username || "").toLowerCase() === "hr-pss";

const isOfficerRow = (row) => Boolean(row) && (row.role === "officer" || row.officer);

const hasOfficerRank = (row) => Boolean(row) && row.role !== "admin" && isOfficerRow(row);

const hasTeamLeadRank = (row) =>
  Boolean(row) && row.role !== "admin" && !isOfficerRow(row) && (row.role === "team_lead" || row.mto);

const hasLeadRights = (row) => hasOfficerRank(row) || hasTeamLeadRank(row);

const isCisoRow = (row) =>
  Boolean(row) && (row.user_id === "PSS002" || String(row.username || "").toLowerCase() === "hassanazwar");

const rowTeams = (row) => (row?.teams?.length ? row.teams : row?.team ? [row.team] : []);

const canReceiveReports = (row) => {
  if (!row || row.active === false) return false;
  if (isCisoRow(row)) return true;
  if (row.role === "admin") return false;
  return row.role === "team_lead" || row.role === "officer" || Boolean(row.officer) || Boolean(row.mto) || hasTeamLeadRank(row);
};

const canReviewMember = (who, member) => {
  if (!member || member.role === "admin" || who.user_id === member.user_id) return false;
  if (member.reports_to !== who.user_id) return false;
  if (hasOfficerRank(who)) return !isOfficerRow(member);
  if (hasTeamLeadRank(who)) return !isOfficerRow(member) && member.role !== "team_lead" && !member.mto;
  return false;
};

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
  const person = await pool.query(`SELECT late_allowed FROM people WHERE user_id = $1`, [userId]);
  const lateAllowed = Boolean(person.rows[0]?.late_allowed);
  const cutoff = new Date(now);
  if (lateAllowed) cutoff.setHours(11, 0, 0, 0);
  else cutoff.setHours(9, 30, 0, 0);
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

const clockOn = (date, time) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

app.put("/api/attendance", async (req, res) => {
  const who = await actor(req);
  if (!who || who.role !== "hr" || isHrPss(who)) {
    res.status(403).json({ error: "Only HR can edit attendance." });
    return;
  }
  const userId = String(req.body.userId || "");
  const date = String(req.body.date || "");
  const checkIn = clockOn(date, String(req.body.checkIn || ""));
  const checkOutRaw = String(req.body.checkOut || "").trim();
  const checkOut = checkOutRaw ? clockOn(date, checkOutRaw) : null;
  if (!checkIn || (checkOutRaw && !checkOut)) {
    res.status(400).json({ error: "Enter a valid date and time." });
    return;
  }
  if (checkOut && checkOut.getTime() < checkIn.getTime()) {
    res.status(400).json({ error: "Check out cannot be before check in." });
    return;
  }
  const person = await pool.query(`SELECT user_id, late_allowed FROM people WHERE user_id = $1`, [userId]);
  if (!person.rows[0]) {
    res.status(404).json({ error: "Person not found." });
    return;
  }
  const cutoff = new Date(checkIn);
  if (person.rows[0].late_allowed) cutoff.setHours(11, 0, 0, 0);
  else cutoff.setHours(9, 30, 0, 0);
  const late = checkIn.getTime() > cutoff.getTime();
  const worked = checkOut ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)) : null;
  await pool.query(
    `INSERT INTO attendance (user_id, date, check_in, check_out, late, worked_minutes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, date) DO UPDATE SET
       check_in = EXCLUDED.check_in,
       check_out = EXCLUDED.check_out,
       late = EXCLUDED.late,
       worked_minutes = EXCLUDED.worked_minutes`,
    [userId, date, checkIn.toISOString(), checkOut ? checkOut.toISOString() : null, late, worked]
  );
  res.json({ state: await readState() });
});

app.delete("/api/attendance", async (req, res) => {
  const who = await actor(req);
  if (!who || who.role !== "hr" || isHrPss(who)) {
    res.status(403).json({ error: "Only HR can edit attendance." });
    return;
  }
  const userId = String(req.body.userId || "");
  const date = String(req.body.date || "");
  const removed = await pool.query(`DELETE FROM attendance WHERE user_id = $1 AND date = $2`, [userId, date]);
  if (!removed.rowCount) {
    res.status(404).json({ error: "Attendance record not found." });
    return;
  }
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
  let team = role === "admin" ? null : body.team || null;
  let teams = team ? [team] : [];
  let reportsTo = role === "admin" ? null : String(body.reportsTo || "").trim() || null;
  if (reportsTo) {
    const managerResult = await pool.query(`SELECT * FROM people WHERE user_id = $1`, [reportsTo]);
    const manager = managerResult.rows[0];
    if (!canReceiveReports(manager)) {
      res.status(400).json({ error: "Choose a team lead, an officer, or the CISO." });
      return;
    }
    const managerTeams = rowTeams(manager);
    if (managerTeams.length) {
      teams = managerTeams;
      team = managerTeams[0];
    }
  }
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
      `INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, mto, reports_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,CURRENT_DATE,$9,$10,$11,$12)`,
      [userId, name, username, email, password, role, team, teams, lateAllowed, workMode, mto, reportsTo]
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
  if (!who || (who.role !== "admin" && !hasLeadRights(who))) {
    res.status(403).json({ error: "Only an admin, officer, team lead, or MTO can edit accounts." });
    return;
  }
  const userId = req.params.userId;
  const current = await pool.query(`SELECT * FROM people WHERE user_id = $1`, [userId]);
  if (!current.rows[0]) {
    res.status(404).json({ error: "Person not found." });
    return;
  }
  const person = current.rows[0];
  if (who.role !== "admin") {
    if (person.role === "admin") {
      res.status(403).json({ error: "You cannot edit an admin." });
      return;
    }
    if (who.user_id !== userId && person.reports_to !== who.user_id) {
      res.status(403).json({ error: "You can only update people who report to you." });
      return;
    }
    if (who.user_id !== userId && hasOfficerRank(who) && isOfficerRow(person)) {
      res.status(403).json({ error: "An admin updates other officers." });
      return;
    }
    if (who.user_id !== userId && hasTeamLeadRank(who) && (isOfficerRow(person) || person.role === "team_lead" || person.mto)) {
      res.status(403).json({ error: "An officer or admin updates officers, team leads, and MTOs." });
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
  let reportsTo = person.reports_to || null;
  if (req.body.reportsTo !== undefined) {
    reportsTo = String(req.body.reportsTo || "").trim() || null;
  }
  if (role === "admin") reportsTo = null;
  if (reportsTo) {
    if (reportsTo === userId) {
      res.status(400).json({ error: "A person cannot report to themselves." });
      return;
    }
    const managerResult = await pool.query(`SELECT * FROM people WHERE user_id = $1`, [reportsTo]);
    const manager = managerResult.rows[0];
    if (!canReceiveReports(manager)) {
      res.status(400).json({ error: "Choose a team lead, an officer, or the CISO." });
      return;
    }
    if (manager.reports_to === userId) {
      res.status(400).json({ error: "That person already reports to this account." });
      return;
    }
    if (req.body.reportsTo !== undefined) {
      const managerTeams = rowTeams(manager);
      if (managerTeams.length) {
        teams = managerTeams;
        team = managerTeams[0];
      }
    }
  }
  const account = accountFields(person, req.body || {});
  if (account.error) {
    res.status(400).json({ error: account.error });
    return;
  }
  try {
    await pool.query(
      `UPDATE people SET role = $2, team = $3, teams = $4, active = $5, late_allowed = $6, work_mode = $7, officer = $8, mto = $9, email = $10, username = $11, password = $12, name = $13, reports_to = $14 WHERE user_id = $1`,
      [userId, role, teams[0] ?? team ?? null, teams, active, lateAllowed, workMode, officer, mto, account.email, account.username, account.password, account.name, reportsTo]
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

app.post("/api/leave/grant", async (req, res) => {
  const who = await actor(req);
  if (!isHrPss(who)) {
    res.status(403).json({ error: "Only the HR PSS account can record leave for other people." });
    return;
  }
  const userId = String(req.body.userId || "");
  const from = String(req.body.from || "");
  const to = String(req.body.to || "");
  const reason = String(req.body.reason || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !reason) {
    res.status(400).json({ error: "Enter the person, dates, and a reason." });
    return;
  }
  if (to < from) {
    res.status(400).json({ error: "The end date cannot be before the start date." });
    return;
  }
  const person = await pool.query(`SELECT user_id, role FROM people WHERE user_id = $1`, [userId]);
  if (!person.rows[0]) {
    res.status(404).json({ error: "Person not found." });
    return;
  }
  if (person.rows[0].role === "hr" || person.rows[0].role === "admin") {
    res.status(400).json({ error: "Leave cannot be recorded for an HR or admin account." });
    return;
  }
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO leave_requests (id, user_id, from_date, to_date, reason, status)
     VALUES ($1,$2,$3,$4,$5,'approved')`,
    [id, userId, from, to, reason]
  );
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
  if (!who || (who.role !== "admin" && !hasLeadRights(who))) {
    res.status(403).json({ error: "Only an admin, officer, team lead, or MTO can review leave." });
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
  if (request.status !== "pending" && who.role !== "admin") {
    res.status(400).json({ error: "This request was already reviewed." });
    return;
  }
  if (request.user_id === who.user_id) {
    res.status(400).json({ error: "You cannot review your own request." });
    return;
  }
  if (who.role !== "admin") {
    const owner = await pool.query(`SELECT role, team, teams, officer, mto FROM people WHERE user_id = $1`, [request.user_id]);
    const member = owner.rows[0];
    if (!canReviewMember(who, member)) {
      res.status(403).json({ error: "You can only review leave for people below your role on your team." });
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

app.delete("/api/leave/:id", async (req, res) => {
  const who = await actor(req);
  if (!who || who.role !== "admin") {
    res.status(403).json({ error: "Only an admin can delete leave." });
    return;
  }
  const removed = await pool.query(`DELETE FROM leave_requests WHERE id = $1`, [req.params.id]);
  if (!removed.rowCount) {
    res.status(404).json({ error: "Leave request not found." });
    return;
  }
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
