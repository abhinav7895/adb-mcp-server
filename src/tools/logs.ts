import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdb, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools related to capturing and managing device logs (logcat).
 * 
 * @param server The MCP server instance.
 */
export function registerLogTools(server: McpServer): void {
  // 1. Get logcat logs
  server.registerTool(
    "get_logcat",
    {
      description: "Dump a snapshot of recent system logs (logcat) with custom line limits and filter criteria.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        limit: z.number().optional().default(100).describe("Maximum number of recent lines to retrieve (e.g. 50, 100, 500)"),
        filterSpec: z.string().optional().describe("Filter specifications matching ADB format (e.g. '*:E' for errors only, 'ActivityManager:I *:S' for info-level ActivityManager logs and silencing others)"),
      },
    },
    async (args) => {
      try {
        // -d: Dump the log and exit (non-blocking)
        // -t <limit>: Print only the most recent N lines
        const logcatArgs = ["logcat", "-d", "-t", String(args.limit)];

        if (args.filterSpec) {
          // ADB logcat accepts filter specs as trailing arguments
          logcatArgs.push(args.filterSpec);
        }

        const { stdout } = await executeAdb(logcatArgs, args.serial);
        
        if (!stdout) {
          return formatSuccessResponse("Logcat output is empty.");
        }

        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "get_logcat");
      }
    }
  );

  // 2. Clear logcat
  server.registerTool(
    "clear_logcat",
    {
      description: "Clear (flush) all current logcat buffers. Useful to run before a test to discard old irrelevant logs.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
      },
    },
    async (args) => {
      try {
        // -c: Clear the log buffer and exit
        await executeAdb(["logcat", "-c"], args.serial);
        return formatSuccessResponse("Logcat log buffer successfully cleared.");
      } catch (error) {
        return formatErrorResponse(error, "clear_logcat");
      }
    }
  );
}
