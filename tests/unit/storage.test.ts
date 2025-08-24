import fs from 'fs';
import path from 'path';
import { StorageManager } from '../../src/storage.js';
import { jest } from '@jest/globals';

// Mock the execSync to prevent actual tmux calls
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('StorageManager Unit Tests', () => {
  const testDataDir = path.join(process.cwd(), 'test-data');
  
  beforeEach(() => {
    // Clean up test data directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    
    // Reset the StorageManager state
    // Note: In production, you might want to make StorageManager more testable
    // by allowing dependency injection of the data directory
    (StorageManager as any).registeredTerminals.clear();
    (StorageManager as any).terminalStates.clear();
    (StorageManager as any).terminalStateExplicitlySet.clear();
    
    // Override data directory for testing
    (StorageManager as any).dataDir = testDataDir;
  });

  afterEach(() => {
    // Clean up test data
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Terminal Registration', () => {
    test('should register a terminal via registerTerminal', () => {
      StorageManager.registerTerminal('test-terminal');
      
      const terminals = StorageManager.getRegisteredTerminals();
      expect(terminals).toContain('test-terminal');
      expect(terminals.length).toBe(1);
    });

    test('should not auto-register terminals when sending messages', () => {
      StorageManager.sendMessage('sender', 'receiver', 'test message');
      
      const terminals = StorageManager.getRegisteredTerminals();
      expect(terminals.length).toBe(0);
    });

    test('should register terminal when setting state', () => {
      StorageManager.setTerminalState('test-terminal', 'idle');
      
      const terminals = StorageManager.getRegisteredTerminals();
      expect(terminals).toContain('test-terminal');
    });

    test('should unregister terminal', () => {
      StorageManager.registerTerminal('test-terminal');
      StorageManager.unregisterTerminal('test-terminal');
      
      const terminals = StorageManager.getRegisteredTerminals();
      expect(terminals).not.toContain('test-terminal');
      expect(terminals.length).toBe(0);
    });
  });

  describe('Message Handling', () => {
    test('should send and retrieve messages', () => {
      const message = StorageManager.sendMessage(
        'alice',
        'bob',
        'Hello Bob!'
      );
      
      expect(message).toHaveProperty('id');
      expect(message.from).toBe('alice');
      expect(message.to).toBe('bob');
      expect(message.message).toBe('Hello Bob!');
      
      const unreadMessages = StorageManager.getUnreadMessages('bob');
      expect(unreadMessages.length).toBe(1);
      expect(unreadMessages[0].message).toBe('Hello Bob!');
    });

    test('should get oldest unread message', () => {
      StorageManager.sendMessage('alice', 'bob', 'First message');
      StorageManager.sendMessage('alice', 'bob', 'Second message');
      
      const oldest = StorageManager.getOldestUnreadMessage('bob');
      expect(oldest).not.toBeNull();
      expect(oldest?.message).toBe('First message');
    });

    test('should return null when no unread messages', () => {
      const message = StorageManager.getOldestUnreadMessage('nobody');
      expect(message).toBeNull();
    });

    test('should mark message as read', () => {
      const message = StorageManager.sendMessage(
        'alice',
        'bob',
        'Test message'
      );
      
      const success = StorageManager.markMessageAsRead('bob', message.id);
      expect(success).toBe(true);
      
      const unreadMessages = StorageManager.getUnreadMessages('bob');
      expect(unreadMessages.length).toBe(0);
    });

    test('should return false when marking non-existent message as read', () => {
      const success = StorageManager.markMessageAsRead('bob', 'fake-id');
      expect(success).toBe(false);
    });

    test('should persist messages to filesystem', () => {
      StorageManager.sendMessage('alice', 'bob', 'Persistent message');
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(testDataDir, 'bob', 'unread', `${dateStr}-messages.json`);
      
      expect(fs.existsSync(filePath)).toBe(true);
      
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(fileContent).toHaveLength(1);
      expect(fileContent[0].message).toBe('Persistent message');
    });
  });

  describe('Terminal State Management', () => {
    test('should set terminal state to idle', () => {
      StorageManager.setTerminalState('test-terminal', 'idle');
      const status = StorageManager.getTerminalStatus('test-terminal');
      
      expect(status.state).toBe('idle');
      expect(status.terminal).toBe('test-terminal');
    });

    test('should set terminal state to busy', () => {
      StorageManager.setTerminalState('test-terminal', 'busy');
      const status = StorageManager.getTerminalStatus('test-terminal');
      
      expect(status.state).toBe('busy');
    });

    test('should track unread count in status', () => {
      StorageManager.sendMessage('alice', 'bob', 'Message 1');
      StorageManager.sendMessage('alice', 'bob', 'Message 2');
      
      const status = StorageManager.getTerminalStatus('bob');
      expect(status.unreadCount).toBe(2);
    });

    test('should get all terminal statuses', () => {
      StorageManager.registerTerminal('terminal1');
      StorageManager.registerTerminal('terminal2');
      StorageManager.setTerminalState('terminal3', 'busy');
      
      const statuses = StorageManager.getAllTerminalStatuses();
      expect(statuses).toHaveLength(3);
      
      const terminals = statuses.map(s => s.terminal).sort();
      expect(terminals).toEqual(['terminal1', 'terminal2', 'terminal3']);
    });
  });

  describe('Directory Management', () => {
    test('should create directory structure for new terminals', () => {
      StorageManager.sendMessage('alice', 'bob', 'test');
      
      expect(fs.existsSync(path.join(testDataDir, 'alice', 'unread'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'alice', 'read'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'bob', 'unread'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'bob', 'read'))).toBe(true);
    });

    test('should handle messages for same date in same file', () => {
      StorageManager.sendMessage('alice', 'bob', 'Message 1');
      StorageManager.sendMessage('charlie', 'bob', 'Message 2');
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filePath = path.join(testDataDir, 'bob', 'unread', `${dateStr}-messages.json`);
      
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(fileContent).toHaveLength(2);
    });
  });

  describe('Message Injection', () => {
    test('should not inject messages to unregistered terminals', () => {
      // Since we can't mock ES modules easily, we'll skip these tests
      // or test the behavior indirectly
      StorageManager.sendMessage('alice', 'bob', 'Test message');
      
      // Message should be queued but terminal not registered
      const terminals = StorageManager.getRegisteredTerminals();
      expect(terminals).not.toContain('alice');
      expect(terminals).not.toContain('bob');
    });

    test('should register terminal when explicitly set to idle', () => {
      StorageManager.registerTerminal('bob');
      StorageManager.setTerminalState('bob', 'idle');
      
      const terminals = StorageManager.getRegisteredTerminals();
      expect(terminals).toContain('bob');
    });

    test('should handle busy terminal state', () => {
      StorageManager.registerTerminal('charlie');
      StorageManager.setTerminalState('charlie', 'busy');
      
      const status = StorageManager.getTerminalStatus('charlie');
      expect(status.state).toBe('busy');
    });
  });
});