#!/bin/bash
set -e

# MailHog configuration (matches docker-compose.yml)
SMTP_PORT="50239"
WEB_PORT="58443"

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

# Skip in CI environment - emails are typically mocked in tests
if [ "$CI" = "true" ]; then
    log_info "CI environment detected - skipping mail server setup"
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

# Start MailHog using Docker
start_with_docker() {
    log_info "Docker detected - starting MailHog with docker compose..."
    docker compose up -d mailhog

    # Wait for MailHog to be ready
    log_info "Waiting for MailHog to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$WEB_PORT" > /dev/null 2>&1; then
            log_info "MailHog is ready!"
            return 0
        fi
        sleep 1
    done

    log_error "MailHog failed to start within 30 seconds"
    return 1
}

# Check if MailHog is already running
mailhog_running() {
    if curl -s "http://localhost:$WEB_PORT" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Install and start MailHog locally (for environments without Docker, like Claude Code Web)
start_without_docker() {
    log_info "Docker not available - setting up MailHog locally..."

    # Check if MailHog is already running
    if mailhog_running; then
        log_info "MailHog already running on ports SMTP:$SMTP_PORT, Web:$WEB_PORT"
        return 0
    fi

    # Check if a process is using our ports
    if lsof -i ":$SMTP_PORT" > /dev/null 2>&1 || lsof -i ":$WEB_PORT" > /dev/null 2>&1; then
        log_warn "Ports $SMTP_PORT or $WEB_PORT are in use. Checking if it's MailHog..."
        if mailhog_running; then
            log_info "MailHog is already running"
            return 0
        fi
        log_error "Ports are in use by another process"
        return 1
    fi

    MAILHOG_BIN="$HOME/.local/bin/MailHog"

    # Install MailHog if not present
    if [ ! -f "$MAILHOG_BIN" ]; then
        log_info "Installing MailHog..."

        # Create bin directory
        mkdir -p "$HOME/.local/bin"

        # Detect architecture
        ARCH=$(uname -m)
        case $ARCH in
            x86_64)
                MAILHOG_ARCH="linux_amd64"
                ;;
            aarch64|arm64)
                MAILHOG_ARCH="linux_arm64"
                ;;
            *)
                log_error "Unsupported architecture: $ARCH"
                return 1
                ;;
        esac

        # MailHog v1.0.1 is the latest release
        MAILHOG_VERSION="v1.0.1"
        MAILHOG_URL="https://github.com/mailhog/MailHog/releases/download/${MAILHOG_VERSION}/MailHog_${MAILHOG_ARCH}"

        log_info "Downloading MailHog $MAILHOG_VERSION..."
        curl -sL "$MAILHOG_URL" -o "$MAILHOG_BIN"
        chmod +x "$MAILHOG_BIN"

        log_info "MailHog installed to $MAILHOG_BIN"
    fi

    # Start MailHog in background
    log_info "Starting MailHog on SMTP:$SMTP_PORT, Web:$WEB_PORT..."

    # Create a log directory
    mkdir -p "$HOME/.local/log"

    # Start MailHog with our configured ports
    nohup "$MAILHOG_BIN" \
        -smtp-bind-addr "0.0.0.0:$SMTP_PORT" \
        -api-bind-addr "0.0.0.0:$WEB_PORT" \
        -ui-bind-addr "0.0.0.0:$WEB_PORT" \
        > "$HOME/.local/log/mailhog.log" 2>&1 &

    MAILHOG_PID=$!
    echo "$MAILHOG_PID" > "$HOME/.local/mailhog.pid"

    # Wait for it to start
    log_info "Waiting for MailHog to be ready..."
    for i in {1..10}; do
        if mailhog_running; then
            log_info "MailHog is ready!"
            return 0
        fi
        sleep 1
    done

    log_error "MailHog failed to start. Check $HOME/.local/log/mailhog.log for details"
    return 1
}

# Main logic
main() {
    log_info "Setting up MailHog for template-alpha..."

    if docker_available; then
        start_with_docker
    else
        start_without_docker
    fi

    log_info "MailHog setup complete!"
    echo ""
    echo "SMTP server: localhost:$SMTP_PORT"
    echo "Web UI: http://localhost:$WEB_PORT"
}

main "$@"
