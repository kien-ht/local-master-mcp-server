#!/bin/bash

# Tmux wrapper script to inject messages into Claude Code terminals

if [ $# -lt 2 ]; then
    echo "Usage: $0 <session-name> <message>"
    echo "Example: $0 claude-backend 'Message from frontend: API ready'"
    exit 1
fi

SESSION_NAME=$1
MESSAGE=$2

# Check if tmux session exists
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Error: Tmux session '$SESSION_NAME' not found"
    echo "Create it with: tmux new-session -d -s $SESSION_NAME"
    exit 1
fi

# Send the message to the tmux session
tmux send-keys -t "$SESSION_NAME" "$MESSAGE"
tmux send-keys -t "$SESSION_NAME" Enter
