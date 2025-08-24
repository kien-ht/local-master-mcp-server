#!/bin/bash

# Setup script for Local Master Server
# Installs dependencies, creates directories, and configures MCP globally

set -e

echo "========================================="
echo "   Local Master Server Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check operating system
OS=$(uname -s)
print_info "Detected OS: $OS"
echo ""

# Check Node.js installation
echo "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js is installed (version: $NODE_VERSION)"
else
    print_error "Node.js is not installed"
    echo ""
    echo "Please install Node.js first:"
    if [[ "$OS" == "Darwin" ]]; then
        echo "  Option 1: Download from https://nodejs.org/"
        echo "  Option 2: Using Homebrew: brew install node"
    elif [[ "$OS" == "Linux" ]]; then
        echo "  Option 1: Download from https://nodejs.org/"
        echo "  Option 2: Using package manager:"
        echo "    Ubuntu/Debian: sudo apt-get install nodejs npm"
        echo "    RHEL/CentOS: sudo yum install nodejs npm"
    fi
    echo ""
    exit 1
fi
echo ""

# Check and install tmux
echo "Checking tmux installation..."
if command -v tmux &> /dev/null; then
    TMUX_VERSION=$(tmux -V)
    print_success "tmux is installed ($TMUX_VERSION)"
else
    print_error "tmux is not installed"
    echo "Installing tmux..."
    
    if [[ "$OS" == "Darwin" ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install tmux
            print_success "tmux installed via Homebrew"
        else
            print_error "Homebrew not found. Please install tmux manually:"
            echo "  1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "  2. Then run: brew install tmux"
            exit 1
        fi
    elif [[ "$OS" == "Linux" ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y tmux
            print_success "tmux installed via apt-get"
        elif command -v yum &> /dev/null; then
            sudo yum install -y tmux
            print_success "tmux installed via yum"
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y tmux
            print_success "tmux installed via dnf"
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm tmux
            print_success "tmux installed via pacman"
        else
            print_error "Could not install tmux automatically. Please install it manually."
            exit 1
        fi
    else
        print_error "Unsupported OS for automatic tmux installation"
        echo "Please install tmux manually for your system"
        exit 1
    fi
fi
echo ""

# Install npm dependencies
echo "Installing npm dependencies..."
if pnpm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi
echo ""

# Create data directories
echo "Creating data directories..."
mkdir -p data
print_success "Data directory created (terminal directories will be created dynamically)"
echo ""

# Make scripts executable
echo "Making scripts executable..."
chmod +x wrapper.sh
chmod +x start-claude.sh
chmod +x setup.sh 2>/dev/null || true
print_success "Scripts are now executable"
echo ""

# Install start-claude globally
echo "Installing start-claude command globally..."
INSTALL_DIR="/usr/local/bin"

# Check if we can write to /usr/local/bin
if [ -w "$INSTALL_DIR" ]; then
    cp start-claude.sh "$INSTALL_DIR/start-claude"
    chmod +x "$INSTALL_DIR/start-claude"
    print_success "start-claude command installed globally"
else
    # Try with sudo
    print_info "Need sudo access to install globally"
    if sudo cp start-claude.sh "$INSTALL_DIR/start-claude" && sudo chmod +x "$INSTALL_DIR/start-claude"; then
        print_success "start-claude command installed globally"
    else
        print_error "Failed to install start-claude globally"
        echo "You can manually copy it with:"
        echo "  sudo cp start-claude.sh /usr/local/bin/start-claude"
        echo "  sudo chmod +x /usr/local/bin/start-claude"
    fi
fi
echo ""

# Configure MCP globally using Claude CLI
echo "Configuring MCP in Claude Code..."

# Check if claude CLI is installed
if command -v claude &> /dev/null; then
    print_info "Adding local-master MCP server to Claude Code..."
    
    # Add MCP server using Claude CLI with SSE transport
    if claude mcp add -t sse local-master http://127.0.0.1:5476/sse -s user; then
        print_success "MCP server 'local-master' added successfully"
    else
        print_error "Failed to add MCP server"
        echo "You can manually add it later with:"
        echo "  claude mcp add -t sse local-master http://127.0.0.1:5476/sse -s user"
    fi
else
    print_error "Claude CLI not found"
    echo ""
    echo "Please install Claude CLI or manually add MCP server:"
    echo "  ${YELLOW}claude mcp add -t sse local-master http://127.0.0.1:5476/sse -s user${NC}"
    echo ""
    echo "Or add to Claude config manually from mcp-config-template.json"
fi
echo ""

# Create example tmux sessions
echo "========================================="
echo "   Setup Complete!"
echo "========================================="
echo ""
print_success "Local Master Server is ready to use"
echo ""
echo "Next Steps:"
echo "==========="
echo ""
echo "1. Start the MCP server:"
echo "   ${GREEN}pnpm start${NC}"
echo ""
echo "2. Restart Claude Code to load the MCP configuration"
echo ""
echo "3. Start Claude in tmux sessions (using global command):"
echo "   ${GREEN}start-claude <terminal-name>${NC}"
echo "   Examples:"
echo "   ${GREEN}start-claude backend${NC}"
echo "   ${GREEN}start-claude frontend${NC}"
echo "   ${GREEN}start-claude api-server${NC}"
echo "   ${GREEN}start-claude mobile-app${NC}"
echo ""
echo "4. Copy instructions to each project:"
echo "   ${GREEN}cp terminal-communication-mcp-instructions.md /path/to/project/${NC}"
echo "   Then edit TERMINAL_TYPE in the copied file"
echo ""
echo "5. Test the server:"
echo "   ${GREEN}curl http://127.0.0.1:5476/health${NC}"
echo ""
echo "For more information, see README.md"
echo ""

# Optional: Start the server immediately
read -p "Would you like to start the MCP server now? (y/n) " -n 1 -r
echo ""
if [[ -z $REPLY || $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_info "Starting MCP server..."
    echo "Press Ctrl+C to stop the server"
    echo ""
    pnpm run dev
fi