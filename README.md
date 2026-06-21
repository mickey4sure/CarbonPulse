# 🌿 CarboNudge: Sustainable Carbon Footprint Tracker
### *Gamified Community Sustainability Platform*

**CarboNudge** is a production-hardened, AI-native platform designed to help communities reduce their carbon footprints together. It offers structured activity tracking, automated AI-generated green insights, and a highly interactive community space featuring group challenges and channel-based discussions.

---

## 🚀 Key Feature Pillars

### 1. 📊 Carbon Activity Log & Telemetry
- **Footprint Logging**: Track emissions across three key areas: **Transit** (km), **Food** (grams), and **Energy** (kWh).
- **Accurate Calculations**: Employs server-side emission calculators (following verified carbon conversion factors) to compute CO₂ equivalents dynamically.

### 2. 🤖 Gemini AI Insights
- **Smart Coaching**: Integrates Google Gemini AI to analyze your logged activities and generate personalized, actionable recommendations to reduce your carbon footprint.
- **Cache-Optimized**: Caches insights for 24 hours to minimize redundant API calls and optimize performance.

### 3. 🏆 Community Hub & Leaderboard
- **Dynamic Leaderboard**: Ranks users based on their logged green actions, with pseudonymized user details (masked emails) for privacy.
- **Milestone Achievements**: Track leveling progress from **Eco Recruit** up to **Eco Champion** based on logged actions and CO₂ saved.
- **Active Challenges**: Join or leave group challenges (like *30-Day Zero Waste*, *Car-Free Week*, *Plant-Based Month*) with real-time participant counts.

### 4. 💬 Community Discussion Boards
- **Dedicated Channels**: Discuss topics in themed channels: `#general`, `#zero-waste`, `#transportation`, `#diet-food`, and `#energy`.
- **Real-Time Commenting**: View chronological message feeds and post instant comments with responsive glassmorphism styles and automatic scroll alignment.

---

## 🛠️ Technical Stack
- **Frontend**: Next.js 14, Tailwind CSS, LocalStorage state sync.
- **Backend**: Express, TypeScript, Prisma ORM, SQLite (development) & PostgreSQL (production).
- **Authentication**: Firebase Client SDK & Firebase Admin SDK validation.
- **Intelligence Layer**: Google Gemini API.

---

## 📦 Installation & Setup

### 1. Prerequisites
- **Node.js** v20+
- **pnpm** package manager
- **Google Gemini API Key**
- **Firebase Project** (for client authentication)

### 2. Run Local Development Environment
1. Clone the repository.
2. Install workspace dependencies:
   ```bash
   pnpm install
   ```
3. Set up database tables and run migration:
   ```bash
   pnpm run migrate
   ```
4. Start both Next.js frontend and Express backend servers:
   - On Windows: run backend and frontend dev commands in separate terminals:
     ```bash
     pnpm dev:backend
     pnpm dev:frontend
     ```
   - On macOS/Linux:
     ```bash
     pnpm dev
     ```

---

## 🧪 Running the Test Suite
Ensure everything works correctly before deploying by running the integration test suites:
```bash
# Run backend routes and algorithm tests
pnpm --filter backend test
```

---

## 🛡️ Hackathon Production Deployment Guide

### 1. Database Configuration (PostgreSQL)
For production, swap the database from SQLite to a managed PostgreSQL instance (e.g. AWS RDS, Google Cloud SQL, or Supabase):
1. In `backend/prisma/schema.prisma`, update the datasource provider to `postgresql`.
2. Generate the production Prisma client:
   ```bash
   pnpm --filter backend exec prisma generate
   ```

### 2. Environment Configurations
Prepare environment variables on your production hosting providers (such as Vercel for Frontend and Render/Heroku for Backend) using the templates:
- **Backend**: Set `DATABASE_URL` (PostgreSQL), `GEMINI_API_KEY`, `ALLOWED_ORIGIN` (live frontend URL), and set `NODE_ENV=production` to disable local bypasses.
- **Frontend**: Set `NEXT_PUBLIC_API_URL` to your production backend server and paste your production Firebase client credentials.
