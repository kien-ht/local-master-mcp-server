import { mcpServer } from '../../src/mcp-server.js';

describe('MCP Server Unit Tests', () => {
  describe('Server Configuration', () => {
    test('should have correct server metadata', () => {
      const serverInfo = (mcpServer as any).server._serverInfo;
      expect(serverInfo.name).toBe('local-master');
      expect(serverInfo.version).toBe('1.0.0');
    });

    test('should have all required tools registered', () => {
      const tools = (mcpServer as any)._registeredTools;
      const toolNames = Object.keys(tools);
      
      expect(toolNames).toContain('send_message');
      expect(toolNames).toContain('get_unread_messages');
      expect(toolNames).toContain('get_oldest_unread_message');
      expect(toolNames).toContain('mark_message_read');
      expect(toolNames).toContain('set_terminal_state');
      expect(toolNames).toContain('list_terminals');
      expect(toolNames.length).toBe(6);
    });
  });

  describe('Tool Schemas', () => {
    test('send_message should have correct schema', () => {
      const tools = (mcpServer as any)._registeredTools;
      const sendMessageTool = tools.send_message;
      
      expect(sendMessageTool).toBeDefined();
      expect(sendMessageTool.description).toBe('Send a message from one terminal to another');
      
      // Check that the schema has required fields
      const schema = sendMessageTool.inputSchema;
      expect(schema.shape.from).toBeDefined();
      expect(schema.shape.to).toBeDefined();
      expect(schema.shape.message).toBeDefined();
    });

    test('get_unread_messages should have correct schema', () => {
      const tools = (mcpServer as any)._registeredTools;
      const tool = tools.get_unread_messages;
      
      expect(tool).toBeDefined();
      expect(tool.description).toBe('Get all unread messages for a specific terminal');
      
      const schema = tool.inputSchema;
      expect(schema.shape.terminal).toBeDefined();
    });

    test('set_terminal_state should have correct schema', () => {
      const tools = (mcpServer as any)._registeredTools;
      const tool = tools.set_terminal_state;
      
      expect(tool).toBeDefined();
      expect(tool.description).toBe('Set the state of a terminal (idle or busy)');
      
      const schema = tool.inputSchema;
      expect(schema.shape.terminal).toBeDefined();
      expect(schema.shape.state).toBeDefined();
    });

    test('list_terminals should have empty schema', () => {
      const tools = (mcpServer as any)._registeredTools;
      const tool = tools.list_terminals;
      
      expect(tool).toBeDefined();
      expect(tool.description).toBe('List all registered terminals');
      
      // list_terminals takes no parameters
      const schemaKeys = Object.keys(tool.inputSchema.shape);
      expect(schemaKeys.length).toBe(0);
    });
  });

  describe('Tool Response Format', () => {
    test('should return content array with text type', async () => {
      const tools = (mcpServer as any)._registeredTools;
      const listTerminalsTool = tools.list_terminals;
      
      const result = await listTerminalsTool.callback({});
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      
      // Parse the JSON response
      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('terminals');
    });
  });
});