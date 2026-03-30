#!/bin/bash
set -e

# This script runs on first PostgreSQL startup to create multiple databases
# on the same instance. The default database (POSTGRES_DB) is created
# automatically by the postgres image entrypoint.

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create Keycloak database
    CREATE DATABASE keycloak_db;
    GRANT ALL PRIVILEGES ON DATABASE keycloak_db TO $POSTGRES_USER;
EOSQL

echo "✓ Created keycloak_db database"
