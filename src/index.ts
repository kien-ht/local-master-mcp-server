import { mcpServer } from "./mcp-server.js";
import { createSSEServer } from "./sse-server.js";

const sseServer = createSSEServer(mcpServer);

sseServer.listen(process.env.PORT || 5476);
