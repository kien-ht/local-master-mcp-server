#!/bin/bash

# Start Claude Code in a tmux session for a specific terminal
# Usage: start-claude <terminal_name>

TERMINAL_NAME=$1

if [ -z "$TERMINAL_NAME" ]; then
    echo "Usage: start-claude <terminal_name>"
    echo "Example: start-claude backend"
    echo "         start-claude api-server"
    echo "         start-claude mobile-app"
    exit 1
fi

# Validate terminal name (alphanumeric, hyphens, underscores only)
if [[ ! "$TERMINAL_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "Invalid terminal name. Use only letters, numbers, hyphens, and underscores."
    exit 1
fi

SESSION_NAME="claude-$TERMINAL_NAME"

# Create local tmux config for Claude sessions with proper mouse scrolling
LOCAL_TMUX_CONF="/tmp/claude-tmux-$TERMINAL_NAME.conf"
cat > "$LOCAL_TMUX_CONF" << 'EOF'
# Official tmux configuration for mouse support
# Enable mouse support (handles clicking, scrolling, resizing)
set -g mouse on

# Increase scrollback buffer
set -g history-limit 50000
EOF

# Function to unregister terminal on exit
cleanup() {
    echo ""
    echo "Session ended. Unregistering terminal '$TERMINAL_NAME'..."
    curl -X POST "http://127.0.0.1:5476/unregister-terminal/$TERMINAL_NAME" \
      -s -o /dev/null -w "Unregistration status: %{http_code}\n"
    # Clean up local tmux config
    rm -f "$LOCAL_TMUX_CONF"
}

# Set up trap to call cleanup on script exit
trap cleanup EXIT

# Kill existing session if it exists
tmux kill-session -t "$SESSION_NAME" 2>/dev/null

# Create new session with local config and start Claude
tmux -f "$LOCAL_TMUX_CONF" new-session -d -s "$SESSION_NAME" "claude"

echo "Claude Code started in $SESSION_NAME"

# Register the terminal with the MCP server
echo "Registering terminal '$TERMINAL_NAME' with MCP server..."
curl -X POST "http://127.0.0.1:5476/register-terminal/$TERMINAL_NAME" \
  -s -o /dev/null -w "Registration status: %{http_code}\n"

echo "To attach: tmux attach -t $SESSION_NAME"

# Attach to the session
tmux attach -t "$SESSION_NAME"