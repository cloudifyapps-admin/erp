#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
while ! pg_isready -h postgres -p 5432 -U erp_user -q; do
    sleep 1
done
echo "PostgreSQL is ready!"

echo "Running database migrations..."
alembic upgrade head 2>/dev/null || echo "Running initial table creation..."

echo "Seeding initial data..."
python -m seeds.seed

echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
