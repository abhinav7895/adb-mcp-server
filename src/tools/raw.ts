import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdb, executeAdbShell, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers raw execution tools to support any ADB or shell command not covered by high-level tools.
 * 
 * @param server The MCP server instance.
 */
export function registerRawTools(server: McpServer): void {
  // 1. Raw ADB command execution (as an array of arguments)
  server.registerTool(
    "execute_raw_adb",
    {
      description: "Execute an arbitrary ADB command by passing raw command-line arguments. Safe from shell injection on the host machine because arguments are passed as an array.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number to target"),
        args: z.array(z.string()).describe("List of command-line arguments to pass to the adb command (e.g. ['forward', 'tcp:8080', 'tcp:8080'])"),
      },
    },
    async (args) => {
      try {
        const { stdout, stderr } = await executeAdb(args.args, args.serial);
        // Sometimes command output resides in stderr but it was successful (e.g. port forwarding outputs nothing or info messages)
        const output = [stdout, stderr].filter(Boolean).join("\n");
        return formatSuccessResponse(output || "Command executed successfully with no output.");
      } catch (error) {
        return formatErrorResponse(error, "execute_raw_adb");
      }
    }
  );

  // 2. Raw device shell command execution
  server.registerTool(
    "execute_shell_command",
    {
      description: "Execute an arbitrary shell command directly on the connected Android device. Allows full access to Android shell utilities (e.g., 'input keyevent 26', 'settings get global airplane_mode_on').",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number to target"),
        command: z.string().describe("The shell command string to run on the Android device (e.g. 'input tap 500 500')"),
      },
    },
    async (args) => {
      try {
        const { stdout, stderr } = await executeAdbShell(args.command, args.serial);
        const output = [stdout, stderr].filter(Boolean).join("\n");
        return formatSuccessResponse(output || "Command executed successfully with no output.");
      } catch (error) {
        return formatErrorResponse(error, "execute_shell_command");
      }
    }
  );
}
