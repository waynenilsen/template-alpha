#!/bin/bash
set -e

# Stripe Mock configuration
STRIPE_MOCK_PORT="59310"
STRIPE_MOCK_VERSION="v0.197.0"

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

# Skip in CI environment - Stripe is typically mocked in tests
if [ "$CI" = "true" ]; then
    log_info "CI environment detected - skipping stripe-mock setup"
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

# Start stripe-mock using Docker
start_with_docker() {
    log_info "Docker detected - starting stripe-mock with docker compose..."
    docker compose up -d stripe-mock

    # Wait for stripe-mock to be ready
    log_info "Waiting for stripe-mock to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$STRIPE_MOCK_PORT" > /dev/null 2>&1; then
            log_info "stripe-mock is ready!"
            return 0
        fi
        sleep 1
    done

    log_error "stripe-mock failed to start within 30 seconds"
    return 1
}

# Check if stripe-mock is already running
stripe_mock_running() {
    if curl -s "http://localhost:$STRIPE_MOCK_PORT" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Install and start stripe-mock locally (for environments without Docker, like Claude Code Web)
start_without_docker() {
    log_info "Docker not available - setting up stripe-mock locally..."

    # Check if stripe-mock is already running
    if stripe_mock_running; then
        log_info "stripe-mock already running on port $STRIPE_MOCK_PORT"
        return 0
    fi

    # Check if a process is using our port
    if lsof -i ":$STRIPE_MOCK_PORT" > /dev/null 2>&1; then
        log_warn "Port $STRIPE_MOCK_PORT is in use. Checking if it's stripe-mock..."
        if stripe_mock_running; then
            log_info "stripe-mock is already running"
            return 0
        fi
        log_error "Port is in use by another process"
        return 1
    fi

    STRIPE_MOCK_BIN="$HOME/.local/bin/stripe-mock"

    # Install stripe-mock if not present
    if [ ! -f "$STRIPE_MOCK_BIN" ]; then
        log_info "Installing stripe-mock..."

        # Create bin directory
        mkdir -p "$HOME/.local/bin"

        # Detect architecture
        ARCH=$(uname -m)
        case $ARCH in
            x86_64)
                STRIPE_MOCK_ARCH="linux_amd64"
                ;;
            aarch64|arm64)
                STRIPE_MOCK_ARCH="linux_arm64"
                ;;
            *)
                log_error "Unsupported architecture: $ARCH"
                log_info "Attempting to install via Go..."
                install_via_go
                return $?
                ;;
        esac

        # Try to download binary from GitHub releases
        # Filename pattern: stripe-mock_{version_without_v}_{os}_{arch}.tar.gz
        VERSION_NUMBER="${STRIPE_MOCK_VERSION#v}"  # Remove 'v' prefix
        STRIPE_MOCK_URL="https://github.com/stripe/stripe-mock/releases/download/${STRIPE_MOCK_VERSION}/stripe-mock_${VERSION_NUMBER}_${STRIPE_MOCK_ARCH}.tar.gz"

        log_info "Downloading stripe-mock $STRIPE_MOCK_VERSION..."
        TEMP_DIR=$(mktemp -d)

        if curl -sL "$STRIPE_MOCK_URL" -o "$TEMP_DIR/stripe-mock.tar.gz" 2>/dev/null; then
            log_info "Extracting stripe-mock..."
            tar -xzf "$TEMP_DIR/stripe-mock.tar.gz" -C "$TEMP_DIR"

            # Find the binary (could be in root or subdirectory)
            EXTRACTED_BIN=$(find "$TEMP_DIR" -name "stripe-mock" -type f | head -1)

            if [ -n "$EXTRACTED_BIN" ] && [ -f "$EXTRACTED_BIN" ]; then
                mv "$EXTRACTED_BIN" "$STRIPE_MOCK_BIN"
                chmod +x "$STRIPE_MOCK_BIN"
                log_info "stripe-mock installed to $STRIPE_MOCK_BIN"
            else
                log_warn "Binary not found in archive, trying Go installation..."
                rm -rf "$TEMP_DIR"
                install_via_go
                return $?
            fi

            rm -rf "$TEMP_DIR"
        else
            log_warn "Failed to download binary, trying Go installation..."
            rm -rf "$TEMP_DIR"
            install_via_go
            return $?
        fi
    fi

    # Start stripe-mock in background
    start_stripe_mock_process
}

# Install stripe-mock via Go
install_via_go() {
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        log_info "Go not found, installing Go..."
        install_go
    fi

    log_info "Installing stripe-mock via Go..."

    # Ensure GOPATH/bin is set up
    export GOPATH="${GOPATH:-$HOME/go}"
    export PATH="$GOPATH/bin:$PATH"

    go install github.com/stripe/stripe-mock@latest

    # Link to our expected location
    mkdir -p "$HOME/.local/bin"
    if [ -f "$GOPATH/bin/stripe-mock" ]; then
        ln -sf "$GOPATH/bin/stripe-mock" "$HOME/.local/bin/stripe-mock"
        log_info "stripe-mock installed via Go"
        start_stripe_mock_process
        return 0
    else
        log_error "Failed to install stripe-mock via Go"
        return 1
    fi
}

# Install Go if not present
install_go() {
    log_info "Installing Go..."

    # Detect architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            GO_ARCH="amd64"
            ;;
        aarch64|arm64)
            GO_ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture for Go: $ARCH"
            return 1
            ;;
    esac

    GO_VERSION="1.22.0"
    GO_URL="https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"

    TEMP_DIR=$(mktemp -d)
    log_info "Downloading Go $GO_VERSION..."
    curl -sL "$GO_URL" -o "$TEMP_DIR/go.tar.gz"

    # Install to user's home directory
    mkdir -p "$HOME/.local"
    tar -C "$HOME/.local" -xzf "$TEMP_DIR/go.tar.gz"
    rm -rf "$TEMP_DIR"

    # Set up environment
    export GOROOT="$HOME/.local/go"
    export GOPATH="$HOME/go"
    export PATH="$GOROOT/bin:$GOPATH/bin:$PATH"

    log_info "Go installed to $GOROOT"
}

# Start the stripe-mock process
start_stripe_mock_process() {
    STRIPE_MOCK_BIN="$HOME/.local/bin/stripe-mock"

    # Also check Go bin path
    if [ ! -f "$STRIPE_MOCK_BIN" ]; then
        GOPATH="${GOPATH:-$HOME/go}"
        if [ -f "$GOPATH/bin/stripe-mock" ]; then
            STRIPE_MOCK_BIN="$GOPATH/bin/stripe-mock"
        fi
    fi

    if [ ! -f "$STRIPE_MOCK_BIN" ]; then
        log_error "stripe-mock binary not found"
        return 1
    fi

    log_info "Starting stripe-mock on port $STRIPE_MOCK_PORT..."

    # Create a log directory
    mkdir -p "$HOME/.local/log"

    # Start stripe-mock with our configured port
    nohup "$STRIPE_MOCK_BIN" \
        -http-port "$STRIPE_MOCK_PORT" \
        > "$HOME/.local/log/stripe-mock.log" 2>&1 &

    STRIPE_MOCK_PID=$!
    echo "$STRIPE_MOCK_PID" > "$HOME/.local/stripe-mock.pid"

    # Wait for it to start
    log_info "Waiting for stripe-mock to be ready..."
    for i in {1..10}; do
        if stripe_mock_running; then
            log_info "stripe-mock is ready!"
            return 0
        fi
        sleep 1
    done

    log_error "stripe-mock failed to start. Check $HOME/.local/log/stripe-mock.log for details"
    cat "$HOME/.local/log/stripe-mock.log" 2>/dev/null || true
    return 1
}

# Main logic
main() {
    log_info "Setting up stripe-mock for template-alpha..."

    if docker_available; then
        start_with_docker
    else
        start_without_docker
    fi

    log_info "stripe-mock setup complete!"
    echo ""
    echo "Stripe Mock API: http://localhost:$STRIPE_MOCK_PORT"
    echo ""
    echo "To use with your app, set:"
    echo "  # Note: stripe-mock requires a valid-looking test key format"
    echo "  STRIPE_SECRET_KEY=\"sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx\""
    echo "  STRIPE_MOCK_URL=\"http://localhost:$STRIPE_MOCK_PORT\""
}

main "$@"
