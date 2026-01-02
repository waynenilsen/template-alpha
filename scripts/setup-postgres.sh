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

# Skip in CI environment - GitHub Actions uses 'services' for PostgreSQL
if [ "$CI" = "true" ]; then
    log_info "CI environment detected - skipping PostgreSQL setup (using GitHub Actions services)"
    exit 0
fi

# Check if Docker is available and running
docker_available() {
    if command -v docker &> /dev/null; then
        # Check if Docker daemon is running
        if docker info &> /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Start PostgreSQL using Docker
start_with_docker() {
    log_info "Docker detected - starting PostgreSQL with docker compose..."
    docker compose up -d postgres

    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U postgres &> /dev/null; then
            log_info "PostgreSQL is ready!"
            return 0
        fi
        sleep 1
    done

    log_error "PostgreSQL failed to start within 30 seconds"
    return 1
}

# Install and start PostgreSQL locally (for environments without Docker, like Claude Code Web)
start_without_docker() {
    log_info "Docker not available - setting up PostgreSQL locally..."

    # Check if PostgreSQL is already installed
    if ! command -v psql &> /dev/null; then
        log_info "Installing PostgreSQL..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq postgresql postgresql-contrib
    fi

    # Ensure PostgreSQL service is running
    log_info "Starting PostgreSQL service..."
    sudo service postgresql start || sudo systemctl start postgresql || true

    # Wait for PostgreSQL to start
    sleep 2

    # Configure PostgreSQL to listen on our custom port
    PG_CONF_DIR=$(sudo -u postgres psql -t -c "SHOW config_file" 2>/dev/null | xargs dirname)

    if [ -n "$PG_CONF_DIR" ]; then
        # Check if we need to update the port
        CURRENT_PORT=$(sudo -u postgres psql -t -c "SHOW port" 2>/dev/null | xargs)

        if [ "$CURRENT_PORT" != "$PG_PORT" ]; then
            log_info "Configuring PostgreSQL to use port $PG_PORT..."

            # Update postgresql.conf
            sudo sed -i "s/^#*port = .*/port = $PG_PORT/" "$PG_CONF_DIR/postgresql.conf"

            # Restart PostgreSQL to apply port change
            sudo service postgresql restart || sudo systemctl restart postgresql
            sleep 2
        fi
    fi

    # Set up the postgres user password and create database
    log_info "Configuring database user and database..."

    # Update pg_hba.conf to allow password authentication for local connections
    PG_HBA=$(sudo -u postgres psql -p "$PG_PORT" -t -c "SHOW hba_file" 2>/dev/null | xargs || echo "")

    if [ -n "$PG_HBA" ] && [ -f "$PG_HBA" ]; then
        # Check if we need to update authentication method
        if ! grep -q "local.*all.*all.*md5" "$PG_HBA" 2>/dev/null; then
            log_info "Updating authentication configuration..."
            # Add md5 auth for local connections before the default peer auth
            sudo sed -i '/^local.*all.*all.*peer/i local   all             all                                     md5' "$PG_HBA" 2>/dev/null || true
            sudo service postgresql reload || sudo systemctl reload postgresql || true
            sleep 1
        fi
    fi

    # Set password for postgres user and create database
    sudo -u postgres psql -p "$PG_PORT" -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';" 2>/dev/null || true

    # Create database if it doesn't exist
    if ! sudo -u postgres psql -p "$PG_PORT" -lqt | cut -d \| -f 1 | grep -qw "$PG_DB"; then
        log_info "Creating database '$PG_DB'..."
        sudo -u postgres createdb -p "$PG_PORT" "$PG_DB"
    else
        log_info "Database '$PG_DB' already exists"
    fi

    # Verify connection works
    log_info "Verifying database connection..."
    if PGPASSWORD="$PG_PASSWORD" psql -h localhost -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" &> /dev/null; then
        log_info "PostgreSQL is ready on port $PG_PORT!"
    else
        # Try peer authentication as fallback
        if sudo -u postgres psql -p "$PG_PORT" -d "$PG_DB" -c "SELECT 1;" &> /dev/null; then
            log_info "PostgreSQL is ready on port $PG_PORT (using peer auth)"
        else
            log_error "Failed to verify PostgreSQL connection"
            return 1
        fi
    fi
}

# Main logic
main() {
    log_info "Setting up PostgreSQL for template-alpha..."

    if docker_available; then
        start_with_docker
    else
        start_without_docker
    fi

    log_info "PostgreSQL setup complete!"
    echo ""
    echo "Connection string:"
    echo "  DATABASE_URL=\"postgresql://$PG_USER:$PG_PASSWORD@localhost:$PG_PORT/$PG_DB\""
}

main "$@"
