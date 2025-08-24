# Local Master MCP Server

A Model Context Protocol (MCP) server that enables seamless communication between Claude Code terminals with dynamic terminal naming and automatic tmux integration for message delivery.

## 🎯 Overview

The Local Master MCP Server provides inter-terminal communication capabilities for Claude Code instances running in different project directories. It uses Server-Sent Events (SSE) for real-time communication and integrates with tmux for automatic message delivery to idle terminals.

## ✨ Features

- **Dynamic Terminal Names**: Create and use any terminal name without configuration
- **Inter-Terminal Messaging**: Send messages between any dynamically named terminals
- **Terminal State Management**: Track idle/busy states for each terminal
- **Automatic Message Delivery**: Inject messages directly into tmux sessions when terminals are idle
- **Persistent Storage**: Messages are stored in the filesystem and survive server restarts
- **Unread Message Tracking**: Keep track of read/unread messages for each terminal
- **MCP Tool Integration**: Full set of MCP tools available in Claude Code
- **Auto-Registration**: Terminals are registered automatically on first use

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd local-master-mcp-server

# Run the setup script
./setup.sh
```

The setup script will:
- Check and install Node.js dependencies
- Install tmux if not present
- Create necessary data directories
- Configure MCP in Claude Code (using `claude mcp add -t sse`)
- Make scripts executable

**Manual MCP Configuration:**
If the setup script fails to add the MCP server, run:
```bash
claude mcp add -t sse local-master http://127.0.0.1:5476/sse
```

### 2. Start the Server

```bash
# Start the MCP server
pnpm start

# Or for development with inspector
pnpm dev
```

The server will run on `http://127.0.0.1:5476`

### 3. Start Claude in Tmux Sessions

The setup script installs a global `start-claude` command. Use it to start Claude in tmux sessions:

```bash
# Use any terminal name you want
start-claude backend
start-claude frontend
start-claude api-server
start-claude mobile-app
start-claude worker
```

This will create tmux sessions named `claude-[terminal-name]` with Claude Code running inside.

### 4. Configure Projects

Copy the instructions file to each project and set the terminal type:

```bash
# Copy to any project and set your terminal name
cp terminal-communication-mcp-instructions.md /path/to/project/
# Edit the file and set CURRENT_TERMINAL to your desired name
# Examples: backend, frontend, api-server, mobile-app, worker, etc.
```

## 📋 Available MCP Tools

Once configured, the following tools are available in Claude Code:

### 1. `mcp__local-master__send_message`
Send a message from one terminal to another.
- **Parameters**: `from`, `to`, `message`
- **Example**: "Send a message to frontend that the API is ready"

### 2. `mcp__local-master__get_oldest_unread_message`
Get the oldest (first) unread message for a terminal.
- **Parameters**: `terminal`
- **Example**: "Check the next message for backend"
- **Note**: More efficient for checking messages one at a time

### 3. `mcp__local-master__get_unread_messages`
Retrieve all unread messages for a terminal.
- **Parameters**: `terminal`
- **Example**: "Show me all unread messages for backend"

### 4. `mcp__local-master__mark_message_read`
Mark a specific message as read.
- **Parameters**: `terminal`, `messageId`
- **Example**: "Mark message abc123 as read for backend"

### 5. `mcp__local-master__set_terminal_state`
Set the state of a terminal (idle or busy).
- **Parameters**: `terminal`, `state`
- **Example**: "Set backend terminal to idle"
- **Note**: When set to idle, any pending messages will be delivered automatically via tmux

### 6. `mcp__local-master__list_terminals`
List all registered terminals in the system.
- **Parameters**: None
- **Example**: "Show me all available terminals"
- **Note**: Terminals are registered automatically when they send or receive their first message

## 📁 File Structure

```
local-master-mcp-server/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── mcp-server.ts           # MCP server implementation
│   ├── sse-server.ts           # SSE server setup
│   └── storage.ts              # File-based storage manager
├── data/                       # Message storage (auto-created)
│   └── [terminal-name]/        # Dynamically created for each terminal
│       ├── unread/            # Unread messages
│       └── read/              # Read messages
├── wrapper.sh                  # Tmux message injection script
├── setup.sh                   # Installation and setup script
├── mcp-config-template.json   # MCP configuration template
├── terminal-communication-mcp-instructions.md  # Instructions for projects
├── package.json               # Node.js dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 💬 Usage Examples

### In Backend Terminal
```bash
# Claude Code command examples:
"Send a message to frontend that the user API now includes avatar field"
"Tell mobile-app the websocket server is ready on port 3001"
"Check if I have any unread messages"
"Set my status to busy while I refactor the database"
```

### In Frontend Terminal
```bash
# Claude Code command examples:
"Notify backend that we need pagination for products endpoint"
"Ask mobile-app about offline sync requirements"
"Show me all unread messages"
"Set this terminal to idle"
```

### In Mobile Terminal
```bash
# Claude Code command examples:
"Tell backend about the new push notification requirements"
"Let frontend know we need smaller image sizes"
"Check the status of all terminals"
"Mark all my messages as read"
```

### With Custom Terminal Names
```bash
# In api-server terminal:
"Tell database-worker that the migration is complete"
"Notify auth-service about the new token format"

# In monitoring terminal:
"Tell all terminals about the scheduled maintenance"
"List all available terminals"
```

## 🔧 Message Flow

1. **Sending**: Terminal A uses `send_message` tool → Message stored in filesystem
2. **Storage**: Messages saved in `data/{terminal}/unread/[date]-messages.json`
3. **Delivery**: If target terminal is idle → Message injected via tmux
4. **Reading**: Terminal B uses `get_unread_messages` to retrieve messages
5. **Archiving**: `mark_message_read` moves messages to read folder

## 🎨 Terminal States

- **`idle`**: Terminal is ready to receive messages (auto-delivery enabled)
- **`busy`**: Terminal is working (messages queued for later)

When a terminal switches from `busy` to `idle`, any pending messages are automatically delivered.

## 🏷️ Dynamic Terminal Names

The system supports any terminal name without pre-configuration. Terminal names can include:
- Letters (a-z, A-Z)
- Numbers (0-9)
- Hyphens (-)
- Underscores (_)

Examples of valid terminal names:
- `backend`, `frontend`, `mobile`
- `api-server`, `web-app`, `mobile-app`
- `auth-service`, `database-worker`, `cache-manager`
- `dev-1`, `staging-2`, `prod-3`

Terminals are automatically registered when they:
- Send their first message
- Receive their first message
- Set their state for the first time

## 🛠️ Troubleshooting

### MCP Tools Not Appearing in Claude Code
1. Ensure server is running: `pnpm dev` or `pnpm start`
2. Check the MCP was added correctly: `claude mcp list`
3. If not listed, add it manually: `claude mcp add -t sse local-master http://127.0.0.1:5476/sse`
4. Restart Claude Code after configuration changes
5. Tools should appear with prefix `mcp__local-master__`

### Messages Not Appearing in Tmux
1. Check tmux session exists: `tmux ls`
2. Verify terminal is set to `idle` state
3. Ensure wrapper.sh has execute permissions: `chmod +x wrapper.sh`

### Server Connection Issues
1. Check port 5476 is not in use: `lsof -i :5476`
2. Verify Node.js is installed: `node -v`
3. Check logs for errors when starting server

## 📝 Development

### Running in Development Mode
```bash
pnpm dev
```

### Building for Production
```bash
pnpm build
pnpm start
```

### Running Tests
```bash
pnpm test
```

## 🔒 Security Notes

- Server runs locally on 127.0.0.1 (localhost only)
- No authentication required for local development
- Messages stored in plain text in local filesystem
- Not intended for production or sensitive data

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues or questions, please open an issue on GitHub or contact the maintainers.

---

**Made with ❤️ for seamless Claude Code terminal communication**