# PSS Attendance Portal

A professional attendance portal for PSS employees, based on [attendance-portal-v2](https://github.com/bilalajmery/attendance-portal-v2). Staff sign in with email and password (no Google login).

## What it does

### Employees
- Sign in with work email and password
- Check in and check out
- Request leave (approved by a team lead or admin)
- View calendar, history, and estimated salary

### Team leads
- Everything an employee can do
- Approve or reject leave for assigned team members
- View today’s team attendance

### Admins
- Create employee, team lead, and admin accounts (email + password)
- Assign team leads
- Review all leave requests
- Attendance, holidays, salary reports, overtime, and portal settings

## Tech stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- React Router v6
- Firebase Authentication (email/password)
- Cloud Firestore

## Setup

1. Install Node.js 18+ and run `npm install`.
2. Create a Firebase project.
3. Enable **Email/Password** under Authentication → Sign-in method. Do not enable Google.
4. Create a Firestore database.
5. Copy `.env.example` to `.env` and fill in `VITE_FIREBASE_*` values.
6. Create the first admin:
   - Authentication → Add user (email + password)
   - Firestore → `admins/{uid}` with fields `email`, `name`, `role: "admin"`
7. Optional: publish rules from `firestore.rules` in the Firebase console.

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

## Roles

| Role | Access |
|------|--------|
| Employee | Dashboard, calendar, salary, leave requests |
| Team lead | Employee access plus team leave and team attendance |
| Admin | Full admin portal |

Employees cannot open `/admin`. Admins are routed to `/admin/dashboard` after login.
