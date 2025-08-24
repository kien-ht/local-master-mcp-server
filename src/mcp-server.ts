import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TerminalType, TerminalState } from "./storage.js";
import { StorageManager } from "./storage.js";

const storage = StorageManager;

const mcpServer = new McpServer(
  {
    name: "local-master",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

// Tool: Send message between terminals
mcpServer.tool(
  "send_message",
  "Send a message from one terminal to another",
  {
    from: z.string().min(1).describe("The name of the sending terminal"),
    to: z.string().min(1).describe("The name of the receiving terminal"),
    message: z.string(),
  },
  async (params) => {
    try {
      const message = storage.sendMessage(
        params.from as TerminalType,
        params.to as TerminalType,
        params.message
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `Message sent from ${params.from} to ${params.to}`,
                messageId: message.id,
                timestamp: message.timestamp,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
      };
    }
  }
);

// Tool: Get unread messages
mcpServer.tool(
  "get_unread_messages",
  "Get all unread messages for a specific terminal",
  {
    terminal: z.string().min(1).describe("The name of the terminal"),
  },
  async (params) => {
    try {
      const messages = storage.getUnreadMessages(
        params.terminal as TerminalType
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                terminal: params.terminal,
                count: messages.length,
                messages: messages,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
      };
    }
  }
);

// Tool: Get oldest unread message
mcpServer.tool(
  "get_oldest_unread_message",
  "Get the oldest unread message for a specific terminal",
  {
    terminal: z.string().min(1).describe("The name of the terminal"),
  },
  async (params) => {
    try {
      const message = storage.getOldestUnreadMessage(
        params.terminal as TerminalType
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                terminal: params.terminal,
                hasMessage: message !== null,
                message: message,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
      };
    }
  }
);

// Tool: Mark message as read
mcpServer.tool(
  "mark_message_read",
  "Mark a specific message as read for a terminal",
  {
    terminal: z.string().min(1).describe("The name of the terminal"),
    messageId: z.string(),
  },
  async (params) => {
    try {
      const success = storage.markMessageAsRead(
        params.terminal as TerminalType,
        params.messageId
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: success,
              message: success
                ? `Message ${params.messageId} marked as read for ${params.terminal}`
                : `Message ${params.messageId} not found in unread messages for ${params.terminal}`,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
      };
    }
  }
);

// Tool: Set terminal state
mcpServer.tool(
  "set_terminal_state",
  "Set the state of a terminal (idle or busy)",
  {
    terminal: z.string().min(1).describe("The name of the terminal"),
    state: z.enum(["idle", "busy"]),
  },
  async (params) => {
    try {
      storage.setTerminalState(
        params.terminal as TerminalType,
        params.state as TerminalState
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Terminal ${params.terminal} state set to ${params.state}`,
              terminal: params.terminal,
              state: params.state,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
      };
    }
  }
);

// Tool: List registered terminals
mcpServer.tool(
  "list_terminals",
  "List all registered terminals",
  {},
  async (params, extra) => {
    try {
      const terminals = storage.getRegisteredTerminals();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                count: terminals.length,
                terminals: terminals,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
      };
    }
  }
);

export { mcpServer };
