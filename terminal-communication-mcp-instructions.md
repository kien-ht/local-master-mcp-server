# Terminal Communication Instructions for Claude Code

## ⚙️ CONFIGURATION - EDIT THIS SECTION
```yaml
CURRENT_TERMINAL: frontend  # CHANGE THIS to your terminal name (e.g., backend, frontend, api-server, mobile-app, etc.)
```

---

## 📋 Your Terminal Identity

You are Claude Code working in the **`{{CURRENT_TERMINAL}}`** terminal of this project. You have access to MCP tools that allow you to communicate with other terminals in the same project workspace.

## 🛠️ Available MCP Communication Tools

You have access to these MCP tools with the prefix `mcp__local-master__`:

### 1. Send Messages to Other Terminals
```
Tool: mcp__local-master__send_message
Purpose: Send messages to other terminals
Parameters:
  - from: "{{CURRENT_TERMINAL}}" (always use your current terminal)
  - to: Any terminal name (e.g., "backend", "frontend", "api-server", "mobile-app", etc.)
  - message: Your message text
```

### 2. Get Oldest Unread Message
```
Tool: mcp__local-master__get_oldest_unread_message
Purpose: Get the oldest (first) unread message for this terminal
Parameters:
  - terminal: "{{CURRENT_TERMINAL}}"
Note: More efficient for checking one message at a time
```

### 3. Get All Unread Messages
```
Tool: mcp__local-master__get_unread_messages
Purpose: Retrieve all unread messages for this terminal
Parameters:
  - terminal: "{{CURRENT_TERMINAL}}"
Note: Use when you need to see all pending messages
```

### 4. Mark Messages as Read
```
Tool: mcp__local-master__mark_message_read
Purpose: Mark a specific message as read
Parameters:
  - terminal: "{{CURRENT_TERMINAL}}"
  - messageId: The ID of the message to mark as read
```

### 5. Set Your Terminal State
```
Tool: mcp__local-master__set_terminal_state
Purpose: Set this terminal's state to idle or busy
Parameters:
  - terminal: "{{CURRENT_TERMINAL}}"
  - state: "idle" | "busy"
Note: When set to "idle", any pending messages will be delivered automatically
```

### 6. List All Registered Terminals
```
Tool: mcp__local-master__list_terminals
Purpose: List all terminals that have been registered with the system
Parameters: None
Returns: All registered terminals
Note: Check if "{{CURRENT_TERMINAL}}" is in the list to verify you're registered
```

## 📨 Communication Guidelines

### ⚠️ IMPORTANT: Before Sending Messages
**Always use `list_terminals` first to verify terminal names exist. If no exact match, confirm with user.**

### When Asked to Communicate:

1. **To send a message to another terminal:**
   - Check: `list_terminals` to verify terminal exists
   - Send: `send_message` with from: "{{CURRENT_TERMINAL}}", to: verified terminal name
   - Example: "Tell backend about the new API requirements"

2. **To check for messages:**
   - Use `get_oldest_unread_message` for quick check of next message
   - Or use `get_unread_messages` to see all pending messages
   - Review messages and mark them as read after processing
   - Inform the user about any important messages

3. **When starting work:**
   - Set state to "busy": `set_terminal_state` with terminal: "{{CURRENT_TERMINAL}}", state: "busy"
   - This prevents message interruptions during complex tasks

4. **When idle or waiting:**
   - Set state to "idle": `set_terminal_state` with terminal: "{{CURRENT_TERMINAL}}", state: "idle"
   - Check for unread messages regularly

## 🔄 Workflow Best Practices

### At Session Start:
1. Check for unread messages using `get_oldest_unread_message` or `get_unread_messages`
2. Report any important messages to the user
3. Set appropriate terminal state based on current task
Note: Terminal is automatically registered when started with `start-claude` command

### During Work:
1. When user asks to notify another terminal, use `send_message` immediately
2. Include relevant context in messages (file names, function names, specific requirements)
3. Be concise but clear in inter-terminal messages

### Message Examples:
- ✅ Good: "Updated User model in models/user.ts - added 'avatar' field (string, optional)"
- ❌ Bad: "Changed user stuff"

- ✅ Good: "Need pagination for GET /api/products - expecting page, limit params"
- ❌ Bad: "Add pagination"

## 🚨 Important Reminders

1. **Verify terminal names** - Use `list_terminals` before sending messages
2. **Always use "{{CURRENT_TERMINAL}}" as your identity**
3. **Check messages regularly** - especially after being idle
4. **Provide context** - Include file paths, function names, and specific details
5. **Acknowledge receipt** - When you receive important messages, let the user know
6. **Terminal states matter** - Set to "busy" during complex work, "idle" when available

## 💡 Quick Commands

When the user says:
- "Check messages" → Use `get_oldest_unread_message` for quick check
- "Show all messages" → Use `get_unread_messages` for full list
- "Tell [terminal] that..." → Use `send_message` to that terminal
- "Set me to idle/busy" → Use `set_terminal_state`
- "Mark message as read" → Use `mark_message_read`
- "List available terminals" → Use `list_terminals` to see all registered terminals

## 🔧 Troubleshooting

If MCP tools are not available:
1. The Local Master MCP Server might not be running
2. Ask user to check: `pnpm dev` in the MCP server directory
3. Ask user to restart Claude Code if needed

Remember: You are the **{{CURRENT_TERMINAL}}** terminal. Always identify yourself correctly in communications!