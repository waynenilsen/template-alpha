#!/bin/bash
set -e

# PostgreSQL configuration (matches docker-compose.yml)
PG_USER="postgres"
PG_PASSWORD="postgres"
PG_DB="template_alpha"
PG_PORT="54673"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is responding on the expected port
pg_is_ready() {
    PGPASSWORD="$PG_PASSWORD" psql -h localhost -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" &> /dev/null
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    local max_attempts=30
    local attempt=1

    log_info "Waiting for PostgreSQL to be ready on port $PG_PORT..."

    while [ $attempt -le $max_attempts ]; do
        if pg_is_ready; then
            log_info "PostgreSQL is ready!"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "PostgreSQL failed to respond after $max_attempts seconds"
    return 1
}

# Main logic
main() {
    # Skip schema push in CI - migrations are handled separately
    if [ "$CI" = "true" ]; then
        log_info "CI environment detected - skipping db:ensure (using GitHub Actions services)"
        exit 0
    fi

    log_info "Ensuring database is ready..."

    # Check if PostgreSQL is already running
    if pg_is_ready; then
        log_info "PostgreSQL is already running on port $PG_PORT"
    else
        log_warn "PostgreSQL is not responding on port $PG_PORT"
        log_info "Starting PostgreSQL..."

        # Run the db:start script
        bun run db:start

        # Wait for it to be ready
        wait_for_postgres
    fi

    # Ensure .env file exists with DATABASE_URL
    ENV_FILE="$(dirname "$0")/../.env"
    DATABASE_URL="postgresql://$PG_USER:$PG_PASSWORD@localhost:$PG_PORT/$PG_DB"

    if [ ! -f "$ENV_FILE" ]; then
        log_info "Creating .env file..."
        echo "DATABASE_URL=\"$DATABASE_URL\"" > "$ENV_FILE"
    elif ! grep -q "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null; then
        log_info "Adding DATABASE_URL to .env file..."
        echo "DATABASE_URL=\"$DATABASE_URL\"" >> "$ENV_FILE"
    fi

    # Export for the current script
    export DATABASE_URL

    # Run prisma db push to ensure schema is up to date
    log_info "Pushing database schema..."
    bunx prisma db push

    log_info "Database is ready!"
}

main "$@"
