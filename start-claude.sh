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

# Create local tmux config for Claude sessions
LOCAL_TMUX_CONF="/tmp/claude-tmux-$TERMINAL_NAME.conf"
cat > "$LOCAL_TMUX_CONF" << 'EOF'
# Local tmux configuration for Claude sessions
# Natural mouse scrolling enabled

# Enable mouse support
set -g mouse on

# Set terminal type for better compatibility
set -g default-terminal "screen-256color"

# Increase scrollback buffer
set -g history-limit 50000

# Make mouse wheel scrolling work naturally
bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'select-pane -t=; copy-mode -e; send-keys -M'"
bind -n WheelDownPane select-pane -t= \; send-keys -M

# Use vi-style keys in copy mode
setw -g mode-keys vi

# Allow clicking to exit copy mode
bind -n MouseDown1Pane select-pane -t= \; send-keys -M \; copy-mode -q

# Don't exit copy mode when dragging with mouse
unbind -T copy-mode-vi MouseDragEnd1Pane

# Allow normal terminal scrolling behavior
set -ga terminal-overrides ',xterm*:smcup@:rmcup@'

# Set escape time to zero for faster command sequences
set -s escape-time 0

# Enable focus events
set -g focus-events on

# Start window numbering at 1
set -g base-index 1
setw -g pane-base-index 1

# Renumber windows when closed
set -g renumber-windows on

# Status bar
set -g status-position bottom
set -g status-style 'bg=colour234 fg=colour137'
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