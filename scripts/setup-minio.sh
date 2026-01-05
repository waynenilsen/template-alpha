#!/bin/bash
set -e

# MinIO configuration (S3-compatible storage)
MINIO_API_PORT="52871"
MINIO_CONSOLE_PORT="52872"
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="minioadmin"
MINIO_VERSION="RELEASE.2024-01-01T16-36-33Z"

# Bucket names
BUCKET_PUBLIC="template-alpha-public"
BUCKET_PRIVATE="template-alpha-private"

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

# Skip in CI environment - S3 is typically mocked in tests
if [ "$CI" = "true" ]; then
    log_info "CI environment detected - skipping MinIO setup"
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

# Start MinIO using Docker
start_with_docker() {
    log_info "Docker detected - starting MinIO with docker compose..."
    docker compose up -d minio

    # Wait for MinIO to be ready
    log_info "Waiting for MinIO to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$MINIO_API_PORT/minio/health/live" > /dev/null 2>&1; then
            log_info "MinIO is ready!"
            create_buckets_docker
            return 0
        fi
        sleep 1
    done

    log_error "MinIO failed to start within 30 seconds"
    return 1
}

# Create buckets using mc (MinIO client) in Docker
create_buckets_docker() {
    log_info "Creating buckets..."

    # Use the minio-mc service to create buckets
    docker compose run --rm minio-mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null 2>&1 || true

    # Create public bucket
    docker compose run --rm minio-mc mb --ignore-existing local/$BUCKET_PUBLIC > /dev/null 2>&1 || true
    log_info "Created bucket: $BUCKET_PUBLIC"

    # Create private bucket
    docker compose run --rm minio-mc mb --ignore-existing local/$BUCKET_PRIVATE > /dev/null 2>&1 || true
    log_info "Created bucket: $BUCKET_PRIVATE"
}

# Check if MinIO is already running
minio_running() {
    if curl -s "http://localhost:$MINIO_API_PORT/minio/health/live" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Install and start MinIO locally (for environments without Docker, like Claude Code Web)
start_without_docker() {
    log_info "Docker not available - setting up MinIO locally..."

    # Check if MinIO is already running
    if minio_running; then
        log_info "MinIO already running on port $MINIO_API_PORT"
        ensure_buckets_local
        return 0
    fi

    # Check if a process is using our ports
    if lsof -i ":$MINIO_API_PORT" > /dev/null 2>&1 || lsof -i ":$MINIO_CONSOLE_PORT" > /dev/null 2>&1; then
        log_warn "Ports $MINIO_API_PORT or $MINIO_CONSOLE_PORT are in use. Checking if it's MinIO..."
        if minio_running; then
            log_info "MinIO is already running"
            ensure_buckets_local
            return 0
        fi
        log_error "Ports are in use by another process"
        return 1
    fi

    MINIO_BIN="$HOME/.local/bin/minio"
    MC_BIN="$HOME/.local/bin/mc"

    # Install MinIO if not present
    if [ ! -f "$MINIO_BIN" ]; then
        log_info "Installing MinIO..."

        # Create bin directory
        mkdir -p "$HOME/.local/bin"

        # Detect architecture
        ARCH=$(uname -m)
        case $ARCH in
            x86_64)
                MINIO_ARCH="amd64"
                ;;
            aarch64|arm64)
                MINIO_ARCH="arm64"
                ;;
            *)
                log_error "Unsupported architecture: $ARCH"
                return 1
                ;;
        esac

        # Download MinIO server binary
        MINIO_URL="https://dl.min.io/server/minio/release/linux-${MINIO_ARCH}/minio"

        log_info "Downloading MinIO server..."
        curl -sL "$MINIO_URL" -o "$MINIO_BIN"
        chmod +x "$MINIO_BIN"

        log_info "MinIO installed to $MINIO_BIN"
    fi

    # Install mc (MinIO client) if not present
    if [ ! -f "$MC_BIN" ]; then
        log_info "Installing MinIO client (mc)..."

        # Detect architecture
        ARCH=$(uname -m)
        case $ARCH in
            x86_64)
                MC_ARCH="amd64"
                ;;
            aarch64|arm64)
                MC_ARCH="arm64"
                ;;
            *)
                log_error "Unsupported architecture: $ARCH"
                return 1
                ;;
        esac

        MC_URL="https://dl.min.io/client/mc/release/linux-${MC_ARCH}/mc"

        log_info "Downloading MinIO client..."
        curl -sL "$MC_URL" -o "$MC_BIN"
        chmod +x "$MC_BIN"

        log_info "MinIO client installed to $MC_BIN"
    fi

    # Create data directory
    MINIO_DATA_DIR="$HOME/.local/minio/data"
    mkdir -p "$MINIO_DATA_DIR"

    # Start MinIO in background
    log_info "Starting MinIO on API:$MINIO_API_PORT, Console:$MINIO_CONSOLE_PORT..."

    # Create a log directory
    mkdir -p "$HOME/.local/log"

    # Set environment variables and start MinIO
    export MINIO_ROOT_USER="$MINIO_ROOT_USER"
    export MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD"

    nohup "$MINIO_BIN" server "$MINIO_DATA_DIR" \
        --address ":$MINIO_API_PORT" \
        --console-address ":$MINIO_CONSOLE_PORT" \
        > "$HOME/.local/log/minio.log" 2>&1 &

    MINIO_PID=$!
    echo "$MINIO_PID" > "$HOME/.local/minio.pid"

    # Wait for it to start
    log_info "Waiting for MinIO to be ready..."
    for i in {1..15}; do
        if minio_running; then
            log_info "MinIO is ready!"
            ensure_buckets_local
            return 0
        fi
        sleep 1
    done

    log_error "MinIO failed to start. Check $HOME/.local/log/minio.log for details"
    cat "$HOME/.local/log/minio.log" 2>/dev/null || true
    return 1
}

# Create buckets using local mc client
ensure_buckets_local() {
    MC_BIN="$HOME/.local/bin/mc"

    if [ ! -f "$MC_BIN" ]; then
        log_warn "MinIO client not found, skipping bucket creation"
        return 0
    fi

    log_info "Configuring MinIO client..."
    "$MC_BIN" alias set local http://localhost:$MINIO_API_PORT "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" > /dev/null 2>&1 || true

    log_info "Creating buckets..."

    # Create public bucket
    "$MC_BIN" mb --ignore-existing local/$BUCKET_PUBLIC > /dev/null 2>&1 || true
    log_info "Created bucket: $BUCKET_PUBLIC"

    # Create private bucket
    "$MC_BIN" mb --ignore-existing local/$BUCKET_PRIVATE > /dev/null 2>&1 || true
    log_info "Created bucket: $BUCKET_PRIVATE"
}

# Main logic
main() {
    log_info "Setting up MinIO (S3-compatible storage) for template-alpha..."

    if docker_available; then
        start_with_docker
    else
        start_without_docker
    fi

    log_info "MinIO setup complete!"
    echo ""
    echo "S3 API endpoint: http://localhost:$MINIO_API_PORT"
    echo "Console UI: http://localhost:$MINIO_CONSOLE_PORT"
    echo ""
    echo "Credentials:"
    echo "  Access Key: $MINIO_ROOT_USER"
    echo "  Secret Key: $MINIO_ROOT_PASSWORD"
    echo ""
    echo "Buckets:"
    echo "  Public:  $BUCKET_PUBLIC (for avatars, public assets)"
    echo "  Private: $BUCKET_PRIVATE (for attachments, private files)"
    echo ""
    echo "Environment variables for your app:"
    echo "  S3_ENDPOINT=\"http://localhost:$MINIO_API_PORT\""
    echo "  S3_ACCESS_KEY=\"$MINIO_ROOT_USER\""
    echo "  S3_SECRET_KEY=\"$MINIO_ROOT_PASSWORD\""
    echo "  S3_BUCKET_PUBLIC=\"$BUCKET_PUBLIC\""
    echo "  S3_BUCKET_PRIVATE=\"$BUCKET_PRIVATE\""
}

main "$@"
