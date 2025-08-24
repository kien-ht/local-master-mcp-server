import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { StorageManager } from "./storage.js";

const storage = StorageManager;

export function createSSEServer(mcpServer: McpServer) {
  const app = express();

  const transportMap = new Map<string, SSEServerTransport>();

  app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    transportMap.set(transport.sessionId, transport);
    await mcpServer.connect(transport);
    console.log(
      `SSE connection established - sessionId: ${transport.sessionId}`
    );
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    console.log("POST /messages - sessionId:", sessionId);
    console.log("POST /messages - Content-Type:", req.headers["content-type"]);

    // Intercept the request to log the body
    let bodyChunks: Buffer[] = [];
    const originalOn = req.on.bind(req);

    req.on = function (event: string, listener: any): any {
      if (event === "data") {
        // Wrap the data listener to capture chunks
        const wrappedListener = (chunk: Buffer) => {
          bodyChunks.push(chunk);
          listener(chunk);
        };
        return originalOn(event, wrappedListener);
      } else if (event === "end") {
        // Wrap the end listener to log the complete body
        const wrappedListener = () => {
          const body = Buffer.concat(bodyChunks).toString("utf8");
          console.log("POST /messages - Body:", JSON.parse(body));
          listener();
        };
        return originalOn(event, wrappedListener);
      }
      return originalOn(event, listener);
    } as any;

    if (!sessionId) {
      console.error("Message received without sessionId");
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const transport = transportMap.get(sessionId);

    if (transport) {
      transport.handlePostMessage(req, res);
    } else {
      console.error(`No transport found for sessionId: ${sessionId}`);
      res.status(404).json({ error: "Session not found" });
    }
  });

  // Terminal registration endpoint - called from start-claude.sh
  app.post("/register-terminal/:terminal", (req, res) => {
    const terminal = req.params.terminal;
    
    // Validate terminal name
    if (!/^[a-zA-Z0-9_-]+$/.test(terminal)) {
      res.status(400).json({ 
        error: "Invalid terminal name. Use only letters, numbers, hyphens, and underscores." 
      });
      return;
    }
    
    try {
      // Register the terminal
      storage.registerTerminal(terminal);
      
      res.json({ 
        success: true,
        message: `Terminal '${terminal}' registered successfully`,
        terminal: terminal,
        state: 'idle'
      });
      
      console.log(`Terminal '${terminal}' registered via HTTP endpoint`);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to register terminal",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Terminal unregistration endpoint - called when terminal exits
  app.post("/unregister-terminal/:terminal", (req, res) => {
    const terminal = req.params.terminal;
    
    try {
      // Unregister the terminal
      storage.unregisterTerminal(terminal);
      
      res.json({ 
        success: true,
        message: `Terminal '${terminal}' unregistered successfully`,
        terminal: terminal
      });
      
      console.log(`Terminal '${terminal}' unregistered via HTTP endpoint`);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to unregister terminal",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return app;
}
