# TimeBlock Commander

AI-managed time-blocking command center for multi-company operators.

## What This Does

- Plans your workdays down to the hour with a smart scheduling engine
- Scores tasks by priority, urgency, strategic value, and deadline proximity
- Protects prime hours (8am–12pm) for deep work
- Tracks time allocation across Aperture Ads, Rentals, DIYP, and Personal
- Detects overload and company imbalance
- Quick mobile capture for adding tasks on the go
- Full task queue with filtering and sorting

## Tech Stack

- **Next.js 14** — App router, API routes, React frontend
- **PostgreSQL 16** — Task and block storage
- **Prisma** — Type-safe ORM
- **Tailwind CSS** — Utility-first styling
- **Docker Compose** — Isolated deployment
- **Zod** — Input validation

## Quick Start (Hetzner / VPS)

### 1. Clone the repo

```bash
ssh your-server
mkdir -p /opt/apps && cd /opt/apps
git clone https://github.com/YOUR_USERNAME/timeblock-commander.git timeblock
cd timeblock
```

### 2. Create your .env file

```bash
cp .env.example .env
nano .env
```

Change these values:
```
DB_PASSWORD=pick_a_strong_password_here
NEXTAUTH_SECRET=run_openssl_rand_base64_32
NEXTAUTH_URL=http://YOUR_SERVER_IP:3100
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 3. Build and start

```bash
docker compose up -d --build
```

First build takes 2-3 minutes. Subsequent starts are instant.

### 4. Initialize the database

```bash
bash scripts/setup.sh
```

### 5. Open it

```
http://YOUR_SERVER_IP:3100
```

## Isolation from Other Apps

This stack is fully isolated:
- **Own Docker network**: `timeblock-net` — no overlap with other containers
- **Own database**: Postgres on port `5433` (not the default 5432)
- **Own port**: App on `3100`
- **Own volume**: `timeblock_pgdata` — data persists across restarts
- **Own directory**: `/opt/apps/timeblock`

Your rentals stack won't know this exists.

## Common Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f app

# Rebuild after code changes
docker compose up -d --build

# Access database directly
docker exec -it timeblock-db psql -U timeblock -d timeblock

# Open Prisma Studio (DB browser)
docker exec -it timeblock-app npx prisma studio
```

## Local Development

```bash
# Install dependencies
npm install

# Start Postgres (use Docker for the DB only)
docker compose up -d db

# Set up local .env
cp .env.example .env
# Edit DATABASE_URL to use localhost:5433

# Push schema to DB
npx prisma db push

# Seed data
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

App runs at `http://localhost:3000` in dev mode.

## Project Structure

```
timeblock/
├── prisma/
│   ├── schema.prisma      # Data model
│   └── seed.ts             # Sample data
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tasks/      # CRUD for tasks
│   │   │   ├── blocks/     # Time block management
│   │   │   ├── schedule/   # Auto-scheduler trigger
│   │   │   └── analytics/  # Time allocation data
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx        # Main dashboard
│   ├── components/
│   │   ├── ui.tsx           # Shared components
│   │   └── QuickCapture.tsx # Mobile capture modal
│   ├── hooks/
│   │   └── useApi.ts       # Client-side data hooks
│   └── lib/
│       ├── constants.ts    # Display mappings
│       ├── db.ts           # Prisma client
│       ├── scheduler.ts    # Auto-scheduling engine
│       ├── schemas.ts      # Zod validation
│       └── scoring.ts      # Task scoring engine
├── docker-compose.yml
├── Dockerfile
└── scripts/setup.sh
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (filters: status, company, carryover) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/[id]` | Get task detail |
| PATCH | `/api/tasks/[id]` | Update task |
| DELETE | `/api/tasks/[id]` | Delete task |
| GET | `/api/blocks?range=day\|week\|month` | Get time blocks |
| PATCH | `/api/blocks` | Mark block complete |
| POST | `/api/schedule` | Trigger scheduling (day/week/reschedule) |
| GET | `/api/analytics?range=week\|month` | Time allocation data |

## Scoring Formula

```
Score = (priority/10 × 30) + (urgency/10 × 25) + strategic(12) + carryover(8 + 4×count) + deadline_proximity(0-30) - reactive_penalty(5)
```

Tasks scoring 70+ get prime hour slots. Top 3 selection biases toward cross-company diversity.

## Phases

- [x] **Phase 1**: Core app, DB, scheduling engine, Docker deployment
- [ ] **Phase 2**: Google Calendar integration
- [ ] **Phase 3**: n8n automation workflows
- [ ] **Phase 4**: OpenAI task structuring agent
- [ ] **Phase 5**: Analytics polish, weekly planning intake

## License

Private — all rights reserved.
