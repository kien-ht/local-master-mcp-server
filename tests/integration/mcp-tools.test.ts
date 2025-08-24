import { mcpServer } from '../../src/mcp-server.js';
import { StorageManager } from '../../src/storage.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('MCP Tools Integration Tests', () => {
  const testDataDir = path.join(process.cwd(), 'test-data-integration');
  
  beforeEach(() => {
    // Clean up test data directory before each test
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    
    // Reset StorageManager state
    (StorageManager as any).registeredTerminals.clear();
    (StorageManager as any).terminalStates.clear();
    (StorageManager as any).terminalStateExplicitlySet.clear();
    (StorageManager as any).dataDir = testDataDir;
  });

  afterEach(() => {
    // Clean up after each test
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Tool: send_message', () => {
    let sendMessageTool: any;
    
    beforeEach(() => {
      sendMessageTool = (mcpServer as any)._registeredTools.send_message;
    });

    test('should successfully send a message between terminals', async () => {
      const result = await sendMessageTool.callback({
        from: 'terminal-a',
        to: 'terminal-b',
        message: 'Hello from A to B'
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.messageId).toBeDefined();
      expect(response.message).toContain('Message sent from terminal-a to terminal-b');
    });

    test('should handle empty message', async () => {
      const result = await sendMessageTool.callback({
        from: 'terminal-a',
        to: 'terminal-b',
        message: ''
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.messageId).toBeDefined();
    });

    test('should handle special characters in message', async () => {
      const specialMessage = 'Message with "quotes", \'apostrophes\', \n newlines, and emoji 🚀';
      const result = await sendMessageTool.callback({
        from: 'terminal-a',
        to: 'terminal-b',
        message: specialMessage
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      
      // Verify message was stored correctly
      const unreadMessages = StorageManager.getUnreadMessages('terminal-b');
      expect(unreadMessages[0].message).toBe(specialMessage);
    });

    test('should handle very long messages', async () => {
      const longMessage = 'x'.repeat(10000);
      const result = await sendMessageTool.callback({
        from: 'terminal-a',
        to: 'terminal-b',
        message: longMessage
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      
      const unreadMessages = StorageManager.getUnreadMessages('terminal-b');
      expect(unreadMessages[0].message.length).toBe(10000);
    });

    test('should send multiple messages in sequence', async () => {
      for (let i = 1; i <= 5; i++) {
        const result = await sendMessageTool.callback({
          from: 'terminal-a',
          to: 'terminal-b',
          message: `Message ${i}`
        });
        
        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      }
      
      const unreadMessages = StorageManager.getUnreadMessages('terminal-b');
      expect(unreadMessages.length).toBe(5);
      expect(unreadMessages[0].message).toBe('Message 1');
      expect(unreadMessages[4].message).toBe('Message 5');
    });

    test('should handle terminal names with special characters', async () => {
      const result = await sendMessageTool.callback({
        from: 'terminal-with-dashes',
        to: 'terminal_with_underscores',
        message: 'Test message'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });

  describe('Tool: get_unread_messages', () => {
    let getUnreadTool: any;
    let sendMessageTool: any;
    
    beforeEach(() => {
      getUnreadTool = (mcpServer as any)._registeredTools.get_unread_messages;
      sendMessageTool = (mcpServer as any)._registeredTools.send_message;
    });

    test('should return empty array when no messages', async () => {
      const result = await getUnreadTool.callback({
        terminal: 'terminal-a'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.count).toBe(0);
      expect(response.messages).toEqual([]);
    });

    test('should retrieve all unread messages', async () => {
      // Send 3 messages
      await sendMessageTool.callback({
        from: 'sender1',
        to: 'receiver',
        message: 'Message 1'
      });
      await sendMessageTool.callback({
        from: 'sender2',
        to: 'receiver',
        message: 'Message 2'
      });
      await sendMessageTool.callback({
        from: 'sender3',
        to: 'receiver',
        message: 'Message 3'
      });
      
      const result = await getUnreadTool.callback({
        terminal: 'receiver'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.count).toBe(3);
      expect(response.messages.length).toBe(3);
      expect(response.messages[0].from).toBe('sender1');
      expect(response.messages[2].from).toBe('sender3');
    });

    test('should maintain message order (FIFO)', async () => {
      for (let i = 1; i <= 5; i++) {
        await sendMessageTool.callback({
          from: 'sender',
          to: 'receiver',
          message: `Message ${i}`
        });
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const result = await getUnreadTool.callback({
        terminal: 'receiver'
      });
      
      const response = JSON.parse(result.content[0].text);
      const messages = response.messages;
      
      // Check messages are in order
      for (let i = 0; i < messages.length - 1; i++) {
        const current = new Date(messages[i].timestamp).getTime();
        const next = new Date(messages[i + 1].timestamp).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });

    test('should not return messages for other terminals', async () => {
      await sendMessageTool.callback({
        from: 'sender',
        to: 'terminal-a',
        message: 'For A'
      });
      await sendMessageTool.callback({
        from: 'sender',
        to: 'terminal-b',
        message: 'For B'
      });
      
      const resultA = await getUnreadTool.callback({ terminal: 'terminal-a' });
      const responseA = JSON.parse(resultA.content[0].text);
      expect(responseA.count).toBe(1);
      expect(responseA.messages[0].message).toBe('For A');
      
      const resultB = await getUnreadTool.callback({ terminal: 'terminal-b' });
      const responseB = JSON.parse(resultB.content[0].text);
      expect(responseB.count).toBe(1);
      expect(responseB.messages[0].message).toBe('For B');
    });
  });

  describe('Tool: get_oldest_unread_message', () => {
    let getOldestTool: any;
    let sendMessageTool: any;
    
    beforeEach(() => {
      getOldestTool = (mcpServer as any)._registeredTools.get_oldest_unread_message;
      sendMessageTool = (mcpServer as any)._registeredTools.send_message;
    });

    test('should return null when no messages', async () => {
      const result = await getOldestTool.callback({
        terminal: 'terminal-a'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.hasMessage).toBe(false);
      expect(response.message).toBeNull();
    });

    test('should return oldest message', async () => {
      await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'First message'
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'Second message'
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'Third message'
      });
      
      const result = await getOldestTool.callback({
        terminal: 'receiver'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.hasMessage).toBe(true);
      expect(response.message.message).toBe('First message');
    });

    test('should not affect unread message count', async () => {
      await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'Test message'
      });
      
      // Get oldest message multiple times
      await getOldestTool.callback({ terminal: 'receiver' });
      await getOldestTool.callback({ terminal: 'receiver' });
      
      // Messages should still be unread
      const unreadMessages = StorageManager.getUnreadMessages('receiver');
      expect(unreadMessages.length).toBe(1);
    });
  });

  describe('Tool: mark_message_read', () => {
    let markReadTool: any;
    let sendMessageTool: any;
    let getUnreadTool: any;
    
    beforeEach(() => {
      markReadTool = (mcpServer as any)._registeredTools.mark_message_read;
      sendMessageTool = (mcpServer as any)._registeredTools.send_message;
      getUnreadTool = (mcpServer as any)._registeredTools.get_unread_messages;
    });

    test('should mark message as read', async () => {
      // Send a message
      const sendResult = await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'Test message'
      });
      
      const sendResponse = JSON.parse(sendResult.content[0].text);
      const messageId = sendResponse.messageId;
      
      // Mark as read
      const markResult = await markReadTool.callback({
        terminal: 'receiver',
        messageId: messageId
      });
      
      const markResponse = JSON.parse(markResult.content[0].text);
      expect(markResponse.success).toBe(true);
      
      // Verify message is no longer in unread
      const unreadResult = await getUnreadTool.callback({ terminal: 'receiver' });
      const unreadResponse = JSON.parse(unreadResult.content[0].text);
      expect(unreadResponse.count).toBe(0);
    });

    test('should handle non-existent message ID', async () => {
      const result = await markReadTool.callback({
        terminal: 'receiver',
        messageId: uuidv4()
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.message).toContain('not found');
    });

    test('should only mark specific message as read', async () => {
      // Send 3 messages
      const messageIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const result = await sendMessageTool.callback({
          from: 'sender',
          to: 'receiver',
          message: `Message ${i}`
        });
        const response = JSON.parse(result.content[0].text);
        messageIds.push(response.messageId);
      }
      
      // Mark middle message as read
      await markReadTool.callback({
        terminal: 'receiver',
        messageId: messageIds[1]
      });
      
      // Check remaining unread messages
      const unreadResult = await getUnreadTool.callback({ terminal: 'receiver' });
      const unreadResponse = JSON.parse(unreadResult.content[0].text);
      expect(unreadResponse.count).toBe(2);
      expect(unreadResponse.messages[0].message).toBe('Message 1');
      expect(unreadResponse.messages[1].message).toBe('Message 3');
    });

    test('should persist read messages', async () => {
      // Send and mark message as read
      const sendResult = await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'Important message'
      });
      
      const sendResponse = JSON.parse(sendResult.content[0].text);
      await markReadTool.callback({
        terminal: 'receiver',
        messageId: sendResponse.messageId
      });
      
      // Verify message is saved in read folder
      const dateStr = new Date().toISOString().split('T')[0];
      const readPath = path.join(testDataDir, 'receiver', 'read', `${dateStr}-messages.json`);
      expect(fs.existsSync(readPath)).toBe(true);
      
      const readMessages = JSON.parse(fs.readFileSync(readPath, 'utf-8'));
      expect(readMessages.length).toBe(1);
      expect(readMessages[0].message).toBe('Important message');
    });
  });

  describe('Tool: set_terminal_state', () => {
    let setStateTool: any;
    let listTerminalsTool: any;
    
    beforeEach(() => {
      setStateTool = (mcpServer as any)._registeredTools.set_terminal_state;
      listTerminalsTool = (mcpServer as any)._registeredTools.list_terminals;
    });

    test('should set terminal to idle state', async () => {
      const result = await setStateTool.callback({
        terminal: 'test-terminal',
        state: 'idle'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.state).toBe('idle');
      
      // Verify terminal is registered
      const listResult = await listTerminalsTool.callback({});
      const listResponse = JSON.parse(listResult.content[0].text);
      expect(listResponse.terminals).toContain('test-terminal');
    });

    test('should set terminal to busy state', async () => {
      const result = await setStateTool.callback({
        terminal: 'test-terminal',
        state: 'busy'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.state).toBe('busy');
    });

    test('should update existing terminal state', async () => {
      // Set to idle
      await setStateTool.callback({
        terminal: 'test-terminal',
        state: 'idle'
      });
      
      // Update to busy
      const result = await setStateTool.callback({
        terminal: 'test-terminal',
        state: 'busy'
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.state).toBe('busy');
      
      // Verify state is updated
      const status = StorageManager.getTerminalStatus('test-terminal');
      expect(status.state).toBe('busy');
    });

    test('should handle multiple terminals independently', async () => {
      await setStateTool.callback({
        terminal: 'terminal-a',
        state: 'idle'
      });
      
      await setStateTool.callback({
        terminal: 'terminal-b',
        state: 'busy'
      });
      
      const statusA = StorageManager.getTerminalStatus('terminal-a');
      const statusB = StorageManager.getTerminalStatus('terminal-b');
      
      expect(statusA.state).toBe('idle');
      expect(statusB.state).toBe('busy');
    });
  });

  describe('Tool: list_terminals', () => {
    let listTerminalsTool: any;
    let setStateTool: any;
    
    beforeEach(() => {
      listTerminalsTool = (mcpServer as any)._registeredTools.list_terminals;
      setStateTool = (mcpServer as any)._registeredTools.set_terminal_state;
    });

    test('should return empty array when no terminals registered', async () => {
      const result = await listTerminalsTool.callback({});
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.count).toBe(0);
      expect(response.terminals).toEqual([]);
    });

    test('should list all registered terminals', async () => {
      // Register multiple terminals
      await setStateTool.callback({ terminal: 'terminal-a', state: 'idle' });
      await setStateTool.callback({ terminal: 'terminal-b', state: 'busy' });
      await setStateTool.callback({ terminal: 'terminal-c', state: 'idle' });
      
      const result = await listTerminalsTool.callback({});
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.count).toBe(3);
      expect(response.terminals).toContain('terminal-a');
      expect(response.terminals).toContain('terminal-b');
      expect(response.terminals).toContain('terminal-c');
    });

    test('should not list unregistered terminals with messages', async () => {
      const sendMessageTool = (mcpServer as any)._registeredTools.send_message;
      
      // Send message without registering terminals
      await sendMessageTool.callback({
        from: 'unregistered-sender',
        to: 'unregistered-receiver',
        message: 'Test'
      });
      
      const result = await listTerminalsTool.callback({});
      
      const response = JSON.parse(result.content[0].text);
      expect(response.count).toBe(0);
      expect(response.terminals).toEqual([]);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle concurrent message sending', async () => {
      const sendMessageTool = (mcpServer as any)._registeredTools.send_message;
      
      // Send multiple messages concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          sendMessageTool.callback({
            from: `sender-${i}`,
            to: 'receiver',
            message: `Concurrent message ${i}`
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      });
      
      // Verify all messages were stored
      const unreadMessages = StorageManager.getUnreadMessages('receiver');
      expect(unreadMessages.length).toBe(10);
    });

    test('should handle terminal name edge cases', async () => {
      const setStateTool = (mcpServer as any)._registeredTools.set_terminal_state;
      
      const edgeCaseNames = [
        'a', // single character
        'terminal-with-many-dashes-in-name',
        'terminal_with_underscores',
        'terminal123',
        '123terminal',
        'UPPERCASE',
        'CamelCase'
      ];
      
      for (const name of edgeCaseNames) {
        const result = await setStateTool.callback({
          terminal: name,
          state: 'idle'
        });
        
        const response = JSON.parse(result.content[0].text);
        expect(response.success).toBe(true);
      }
      
      const listTerminalsTool = (mcpServer as any)._registeredTools.list_terminals;
      const listResult = await listTerminalsTool.callback({});
      const listResponse = JSON.parse(listResult.content[0].text);
      
      expect(listResponse.terminals.length).toBe(edgeCaseNames.length);
    });

    test('should maintain data integrity across operations', async () => {
      const sendMessageTool = (mcpServer as any)._registeredTools.send_message;
      const markReadTool = (mcpServer as any)._registeredTools.mark_message_read;
      const getUnreadTool = (mcpServer as any)._registeredTools.get_unread_messages;
      
      // Send messages
      const messageIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await sendMessageTool.callback({
          from: 'sender',
          to: 'receiver',
          message: `Message ${i}`
        });
        const response = JSON.parse(result.content[0].text);
        messageIds.push(response.messageId);
      }
      
      // Mark some as read
      await markReadTool.callback({ terminal: 'receiver', messageId: messageIds[0] });
      await markReadTool.callback({ terminal: 'receiver', messageId: messageIds[2] });
      await markReadTool.callback({ terminal: 'receiver', messageId: messageIds[4] });
      
      // Verify unread count
      const unreadResult = await getUnreadTool.callback({ terminal: 'receiver' });
      const unreadResponse = JSON.parse(unreadResult.content[0].text);
      expect(unreadResponse.count).toBe(2);
      expect(unreadResponse.messages[0].message).toBe('Message 1');
      expect(unreadResponse.messages[1].message).toBe('Message 3');
    });

    test('should handle file system persistence correctly', async () => {
      const sendMessageTool = (mcpServer as any)._registeredTools.send_message;
      
      // Send message
      await sendMessageTool.callback({
        from: 'sender',
        to: 'receiver',
        message: 'Persistent message'
      });
      
      // Verify file exists
      const dateStr = new Date().toISOString().split('T')[0];
      const unreadPath = path.join(testDataDir, 'receiver', 'unread', `${dateStr}-messages.json`);
      expect(fs.existsSync(unreadPath)).toBe(true);
      
      // Read file directly
      const fileContent = JSON.parse(fs.readFileSync(unreadPath, 'utf-8'));
      expect(Array.isArray(fileContent)).toBe(true);
      expect(fileContent.length).toBe(1);
      expect(fileContent[0].message).toBe('Persistent message');
    });
  });
});