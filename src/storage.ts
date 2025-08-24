import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { execSync } from "child_process";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

export type TerminalType = string; // Now accepts any string as terminal name
export type TerminalState = "idle" | "busy";

export interface Message {
  id: string;
  from: TerminalType;
  to: TerminalType;
  message: string;
  timestamp: string;
}

export interface TerminalStatus {
  terminal: TerminalType;
  state: TerminalState;
  lastActivity: string;
  unreadCount: number;
}

class StorageManagerClass {
  private dataDir: string;
  private terminalStates: Map<TerminalType, TerminalState> = new Map();
  private registeredTerminals: Set<TerminalType> = new Set();
  private terminalStateExplicitlySet: Set<TerminalType> = new Set();

  constructor() {
    this.dataDir = path.join(currentDirPath, "..", "data");
    this.initializeStorage();
  }

  private initializeStorage() {
    // Create base data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Don't load terminals from folders - only track actively registered terminals
    console.log("StorageManager initialized - terminals must register via API");
  }

  private ensureTerminalDirectories(terminal: TerminalType) {
    // Only create directories, don't register the terminal
    const messageTypes = ["unread", "read"];
    messageTypes.forEach((type) => {
      const dir = path.join(this.dataDir, terminal, type);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private getDateString(): string {
    return new Date().toISOString().split("T")[0];
  }

  private getMessageFilePath(
    terminal: TerminalType,
    type: "unread" | "read"
  ): string {
    const dateStr = this.getDateString();
    return path.join(this.dataDir, terminal, type, `${dateStr}-messages.json`);
  }

  private readMessages(filePath: string): Message[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private writeMessages(filePath: string, messages: Message[]) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
  }

  public sendMessage(
    from: TerminalType,
    to: TerminalType,
    message: string
  ): Message {
    // Ensure directories exist for both terminals
    this.ensureTerminalDirectories(from);
    this.ensureTerminalDirectories(to);

    const msg: Message = {
      id: uuidv4(),
      from,
      to,
      message,
      timestamp: new Date().toISOString(),
    };

    const unreadPath = this.getMessageFilePath(to, "unread");
    const messages = this.readMessages(unreadPath);
    messages.push(msg);
    this.writeMessages(unreadPath, messages);

    // Check if target terminal is idle and has explicitly set its state
    // Only inject if the terminal state was explicitly set (not just defaulted)
    if (
      this.terminalStates.get(to) === "idle" &&
      this.terminalStateExplicitlySet.has(to)
    ) {
      // Run injection asynchronously to not block the response
      setImmediate(() => {
        this.injectMessageToTmux(to, msg);
      });
    }

    return msg;
  }

  public getUnreadMessages(terminal: TerminalType): Message[] {
    this.ensureTerminalDirectories(terminal);
    const unreadPath = this.getMessageFilePath(terminal, "unread");
    return this.readMessages(unreadPath);
  }

  public getOldestUnreadMessage(terminal: TerminalType): Message | null {
    const unreadMessages = this.getUnreadMessages(terminal);
    return unreadMessages.length > 0 ? unreadMessages[0] : null;
  }

  public markMessageAsRead(terminal: TerminalType, messageId: string): boolean {
    this.ensureTerminalDirectories(terminal);
    const unreadPath = this.getMessageFilePath(terminal, "unread");
    const readPath = this.getMessageFilePath(terminal, "read");

    const unreadMessages = this.readMessages(unreadPath);
    const messageIndex = unreadMessages.findIndex((m) => m.id === messageId);

    if (messageIndex === -1) {
      return false;
    }

    const message = unreadMessages.splice(messageIndex, 1)[0];
    const readMessages = this.readMessages(readPath);
    readMessages.push(message);

    this.writeMessages(unreadPath, unreadMessages);
    this.writeMessages(readPath, readMessages);

    return true;
  }

  public setTerminalState(terminal: TerminalType, state: TerminalState): void {
    this.ensureTerminalDirectories(terminal);
    
    // Register terminal if not already registered
    if (!this.registeredTerminals.has(terminal)) {
      this.registeredTerminals.add(terminal);
      console.log(`Terminal '${terminal}' auto-registered via state change`);
    }
    
    this.terminalStates.set(terminal, state);
    this.terminalStateExplicitlySet.add(terminal);

    // If setting to idle, check for unread messages and inject them
    if (state === "idle") {
      const unreadMessages = this.getUnreadMessages(terminal);
      if (unreadMessages.length > 0) {
        // Inject the first unread message asynchronously
        setImmediate(() => {
          this.injectMessageToTmux(terminal, unreadMessages[0]);
        });
      }
    }
  }

  public getTerminalStatus(terminal: TerminalType): TerminalStatus {
    this.ensureTerminalDirectories(terminal);
    const unreadMessages = this.getUnreadMessages(terminal);
    return {
      terminal,
      state: this.terminalStates.get(terminal) || "idle",
      lastActivity: new Date().toISOString(),
      unreadCount: unreadMessages.length,
    };
  }

  public getAllTerminalStatuses(): TerminalStatus[] {
    // Return status for all registered terminals
    return Array.from(this.registeredTerminals).map((t) =>
      this.getTerminalStatus(t)
    );
  }

  public getRegisteredTerminals(): string[] {
    return Array.from(this.registeredTerminals);
  }

  public registerTerminal(terminal: TerminalType): void {
    // Explicitly register a terminal (called from HTTP endpoint)
    this.ensureTerminalDirectories(terminal);
    
    // Add to registered terminals if not already there
    if (!this.registeredTerminals.has(terminal)) {
      this.registeredTerminals.add(terminal);
      this.terminalStates.set(terminal, "idle");
      // Mark as explicitly registered so messages can be delivered via tmux
      this.terminalStateExplicitlySet.add(terminal);
      console.log(`Terminal '${terminal}' registered via HTTP endpoint`);
    }
  }

  public unregisterTerminal(terminal: TerminalType): void {
    // Unregister a terminal (called when terminal exits)
    // Note: We keep the directories and messages for history
    this.registeredTerminals.delete(terminal);
    this.terminalStates.delete(terminal);
    this.terminalStateExplicitlySet.delete(terminal);
    console.log(`Terminal '${terminal}' unregistered (messages preserved)`);
  }

  private injectMessageToTmux(terminal: TerminalType, message: Message) {
    const wrapperPath = path.join(currentDirPath, "..", "wrapper.sh");

    if (!fs.existsSync(wrapperPath)) {
      console.log(`Wrapper script not found at ${wrapperPath}`);
      return;
    }

    try {
      // Map terminal type to tmux session name
      const sessionName = `claude-${terminal}`;
      // Escape single quotes in the message to prevent shell injection
      const escapedMessage = message.message.replace(/'/g, "'\\''");
      const formattedMessage = `📨 Message from ${message.from}: ${escapedMessage}`;

      // Use execSync with a timeout to prevent hanging
      const result = execSync(
        `sh '${wrapperPath}' '${sessionName}' '${formattedMessage}'`,
        {
          timeout: 3000,
          stdio: "pipe", // Capture output instead of inheriting
          encoding: "utf8",
        }
      );

      console.log(`Message injected to ${terminal} terminal via tmux`);
      if (result) {
        console.log(`Tmux output: ${result}`);
      }
    } catch (error: any) {
      // Don't log errors for non-existent tmux sessions, as this is expected
      if (error.message && error.message.includes("not found")) {
        console.log(`Tmux session for ${terminal} not active, message queued`);
      } else if (error.code === "ETIMEDOUT") {
        console.error(`Tmux injection timed out for ${terminal}`);
      } else {
        console.error(
          `Failed to inject message to tmux for ${terminal}:`,
          error.message
        );
      }
    }
  }
}

// Create singleton instance
export const StorageManager = new StorageManagerClass();
