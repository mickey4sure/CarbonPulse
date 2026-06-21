# Original User Request

## Initial Request — 2026-06-21T14:32:02+05:30

CarboNudge is a near-complete carbon footprint tracker built for a hackathon. The backend (Express + Prisma + PostgreSQL + Gemini API) and frontend (Next.js 14, 5 pages) are fully coded and tested (55 tests passing). This sprint finalizes the last 20% for a **production-ready** submission.

Working directory: c:\Users\micke\Desktop\Desktop\CarboNudge

Integrity mode: development

---

## Context

- **Backend**: `backend/` — Express + Prisma ORM, routes at `/api/activities` and `/api/insights`, 55 unit + integration tests passing.
- **Frontend**: `frontend/` — Next.js 14 app at `http://localhost:3000`. Pages: `/dashboard`, `/log`, `/insights`, `/habits`, `/community`. Uses Tailwind with full CarboNudge design tokens (Eco Green `#154212`, Growth Lime `#A2D149`).
- **Prisma schema**: `backend/prisma/schema.prisma` — models: `User`, `ActivityLog`, `Insight`. Migration has NOT been run yet.
- **Workspace**: pnpm monorepo. Run frontend with `pnpm --filter frontend dev`, backend with `pnpm --filter backend dev`.

---

## Requirements

### R1. Database Setup & Prisma Migration

Configure the backend database connection and run the Prisma migration so the backend API is fully functional.

**Strategy — try both in order:**
1. **PostgreSQL first**: Check if a `DATABASE_URL` already exists in `backend/.env`. If it points to a live PostgreSQL instance (test with `prisma db pull` or a ping), run `prisma migrate dev --name init_carbon_schema` against it.
2. **SQLite fallback**: If PostgreSQL is unavailable or `DATABASE_URL` is not set, automatically switch by updating `backend/prisma/schema.prisma` (set `provider = "sqlite"`) and writing `DATABASE_URL="file:./dev.db"` to `backend/.env`. Then run `prisma migrate dev --name init_carbon_schema`.

In both cases, verify the backend starts without errors and `/api/activities` returns HTTP `200` or `401` (not `500`).

### R2. Dark Mode Toggle

Add a dark mode toggle to the CarboNudge app shell. The toggle should appear in the sidebar (desktop) and in the mobile top header. When activated, the entire UI must switch to a dark theme consistent with the existing design tokens — use the `inverse-surface` (`#233144`) and `inverse-on-surface` (`#ebf1ff`) tokens already defined in `tailwind.config.ts` as the dark background/text colors. The preference must be persisted in `localStorage`. Do not introduce any new dependencies.

### R3. Playwright E2E Tests

Install Playwright in the frontend package and write end-to-end tests covering the core user journey. The tests must run against the locally running dev server (`http://localhost:3000`). Tests are production-quality: they must not use arbitrary `sleep` delays, must use proper `waitFor` assertions, and must clean up any state they create. No placeholder or skipped tests are acceptable.

---

## Acceptance Criteria

### R1 — Database
- [ ] `backend/.env` exists and contains a valid `DATABASE_URL`
- [ ] `pnpm --filter backend exec prisma migrate dev` completes without errors
- [ ] `pnpm --filter backend dev` starts without crashing
- [ ] `curl http://localhost:3001/api/activities` returns HTTP 200 or 401 (not 500)
- [ ] `pnpm --filter backend test` still passes all 55 tests after migration

### R2 — Dark Mode
- [ ] A toggle button (moon/sun icon) is visible in the sidebar on desktop and in the mobile header
- [ ] Clicking the toggle switches the `<html>` element's class between `light` and `dark`
- [ ] In dark mode, the page background becomes dark (≥ contrast ratio 4.5:1 for body text against background)
- [ ] Refreshing the page preserves the selected mode (localStorage persistence)
- [ ] No new npm packages are added

### R3 — E2E Tests
- [ ] Playwright is installed: `frontend/playwright.config.ts` exists
- [ ] Test file `frontend/e2e/carbon-flow.spec.ts` exists
- [ ] Tests cover: (a) navigating to `/log`, (b) selecting "Transit" category, (c) entering a value and seeing the CO₂ preview appear, (d) clicking "Log Activity" and seeing success state
- [ ] Tests cover: (e) navigating to `/dashboard` and verifying the Overview heading renders
- [ ] `npx playwright test` from the `frontend/` directory exits with code 0
