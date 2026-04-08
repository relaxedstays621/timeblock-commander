#!/bin/bash
# ─────────────────────────────────────────────────────────
# TimeBlock Commander — First-run setup
# Run this ONCE after docker-compose up to initialize the DB
# ─────────────────────────────────────────────────────────

set -e

echo "⏳ Waiting for database to be ready..."
sleep 3

echo "📦 Running Prisma migrations..."
docker exec timeblock-app npx prisma db push

echo "🌱 Seeding initial data..."
docker exec timeblock-app npx tsx prisma/seed.ts

echo ""
echo "✅ TimeBlock Commander is ready!"
echo "🌐 Open http://YOUR_SERVER_IP:3100"
echo ""
