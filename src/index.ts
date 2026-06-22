#!/usr/bin/env node

/**
 * ADB MCP Server
 * Exposes Android Debug Bridge (ADB) functionality as Model Context Protocol (MCP) tools.
 * 
 * Main entry point: initializes the MCP server, registers all tool modules, 
 * and connects via the standard Input/Output transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import modular tool registration functions
import { registerDeviceTools } from "./tools/devices.js";
import { registerAppTools } from "./tools/apps.js";
import { registerFileTools } from "./tools/files.js";
import { registerLogTools } from "./tools/logs.js";
import { registerDiagnosticTools } from "./tools/diagnostics.js";
import { registerDatabaseTools } from "./tools/databases.js";
import { registerInputTools } from "./tools/inputs.js";
import { registerRawTools } from "./tools/raw.js";

async function main(): Promise<void> {
  // Initialize the MCP server
  const server = new McpServer({
    name: "adb-mcp-server",
    version: "1.0.0",
  });

  // Register tools group by group
  registerDeviceTools(server);
  registerAppTools(server);
  registerFileTools(server);
  registerLogTools(server);
  registerDiagnosticTools(server);
  registerDatabaseTools(server);
  registerInputTools(server);
  registerRawTools(server);

  // Setup standard Input/Output (stdio) transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stderr logging only — stdout is reserved for JSON-RPC MCP messages
  process.stderr.write("ADB MCP Server successfully running and listening for commands...\n");
}

main().catch((error: Error) => {
  process.stderr.write(`Fatal error during server startup: ${error.message}\n`);
  process.exit(1);
});
