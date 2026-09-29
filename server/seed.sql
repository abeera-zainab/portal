-- Bundled attendance database. Loaded once on a new install.

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS001', 'PSS Admin', 'admin', 'admin@pss.local', 'admin123', 'admin', NULL, ARRAY[]::text[], TRUE, '2026-09-24', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS002', 'Hassan Azwar', 'hassanazwar', 'hassanazwar@local.pss', '123123123', 'admin', NULL, ARRAY[]::text[], TRUE, '2026-09-25', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS003', 'Taymur Iqbal', 'taymuriqbal', 'taymuriqbal@local.pss', '123123123', 'team_lead', 'ops', ARRAY['ops']::text[], TRUE, '2026-09-25', FALSE, NULL, TRUE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS004', 'Hanan Jatoi', 'hananjatoi', 'hananjatoi@local.pss', '123123123', 'team_lead', 'defensive', ARRAY['defensive', 'ops']::text[], TRUE, '2026-09-25', FALSE, NULL, TRUE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS005', 'Nawal Ali', 'nawal', 'nawal@local.pss', '123123123', 'team_lead', 'product', ARRAY['product']::text[], TRUE, '2026-09-25', FALSE, NULL, TRUE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS006', 'Saad Amin', 'saadamin', 'saadminz@local.pss', '123123123', 'team_lead', 'product', ARRAY['product']::text[], TRUE, '2026-09-25', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS007', 'Tanjeena Manzoor', 'tanjeenamanzoor', 'tanjeena@local.pss', '123123123', 'team_lead', 'product', ARRAY['product']::text[], TRUE, '2026-09-25', FALSE, NULL, TRUE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS008', 'Zainab', 'zaynab', 'zaynab@local.pss', '123123123', 'employee', 'product', ARRAY['product']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, TRUE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS009', 'Ikhtiar Ali', 'ikhtiar', 'ikhtiar@local.pss', '123123123', 'officer', 'ops', ARRAY['ops']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS010', 'Yousaf Sani', 'yousafsani', 'yousafsani@local.pss', '123123123', 'team_lead', 'offensive', ARRAY['offensive']::text[], TRUE, '2026-09-27', TRUE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS011', 'Sultan Umar Cheema', 'sultan_cheema', 'sultancheema@local.pss', '123123123', 'team_lead', 'offensive', ARRAY['offensive']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, TRUE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS012', 'Jalal Khan', 'jalal_khan', 'jalalkhan@local.pss', '123123123', 'employee', 'ops', ARRAY['ops']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS013', 'Abeera Zainab', 'abeera_zainab', 'abeerazainab@local.pss', '123123123', 'employee', 'product', ARRAY['product']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS014', 'Lubna Basharat', 'lubna_basharat', 'lubnabasharat@local.pss', '123123123', 'employee', 'product', ARRAY['product']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS015', 'Talha Obaid', 'talha_obaid', 'talhaobaid@local.pss', '123123123', 'team_lead', 'defensive', ARRAY['defensive', 'ops']::text[], TRUE, '2026-09-27', TRUE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS016', 'Abdullah Nadeem', 'abdullah_nadeem', 'abdullahnadeem@local.pss', 'Qw3Rty345', 'employee', 'ops', ARRAY['ops', 'defensive']::text[], TRUE, '2026-09-27', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO people (user_id, name, username, email, password, role, team, teams, active, joined, late_allowed, work_mode, officer, mto)
VALUES ('PSS017', 'Haroon Allahdad', 'haroon_allahdad', 'haroonniftac@gmail.com', '123123123', 'employee', 'defensive', ARRAY['defensive', 'ops']::text[], TRUE, '2026-09-28', FALSE, NULL, FALSE, FALSE)
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
  mto = EXCLUDED.mto;

INSERT INTO attendance (user_id, date, check_in, check_out, late, worked_minutes)
VALUES ('PSS003', '2026-09-28', '2026-09-28T05:05:06.852Z'::timestamptz, NULL, TRUE, NULL)
ON CONFLICT (user_id, date) DO NOTHING;

INSERT INTO attendance (user_id, date, check_in, check_out, late, worked_minutes)
VALUES ('PSS016', '2026-09-28', '2026-09-28T09:11:14.827Z'::timestamptz, NULL, TRUE, NULL)
ON CONFLICT (user_id, date) DO NOTHING;

INSERT INTO leave_requests (id, user_id, from_date, to_date, reason, status, rejection_reason)
VALUES ('01ea0256-7978-468a-8abf-bd8fa5e6c422', 'PSS016', '2026-09-01', '2027-05-28', 'Awain', 'rejected', 'none')
ON CONFLICT (id) DO NOTHING;

INSERT INTO leave_requests (id, user_id, from_date, to_date, reason, status, rejection_reason)
VALUES ('a88eb27a-c530-4ca7-a150-d3a019c13da0', 'PSS016', '2026-09-28', '2026-10-02', 'Casual Leave', 'approved', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO leave_requests (id, user_id, from_date, to_date, reason, status, rejection_reason)
VALUES ('fc329b76-de96-46c1-ae87-1691f55d449c', 'PSS016', '2026-09-30', '2026-10-02', 'jkl', 'rejected', 'jhhj')
ON CONFLICT (id) DO NOTHING;
