import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdb, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools related to file transfers between the host and the Android device.
 * 
 * @param server The MCP server instance.
 */
export function registerFileTools(server: McpServer): void {
  // 1. Push file to device
  server.registerTool(
    "push_file",
    {
      description: "Copy a file or directory from the host machine to the connected device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        localPath: z.string().describe("Absolute file path of the source file/directory on the host computer"),
        remotePath: z.string().describe("Target absolute file path on the Android device (e.g. '/sdcard/Download/file.txt')"),
      },
    },
    async (args) => {
      try {
        const { stdout, stderr } = await executeAdb(["push", args.localPath, args.remotePath], args.serial);
        // adb push output is sometimes printed to stderr even on success (like transfer speeds)
        return formatSuccessResponse(`${stdout || stderr || "File successfully pushed to device."}`);
      } catch (error) {
        return formatErrorResponse(error, "push_file");
      }
    }
  );

  // 2. Pull file from device
  server.registerTool(
    "pull_file",
    {
      description: "Copy a file or directory from the connected device to the host machine.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        remotePath: z.string().describe("Absolute file path of the source file/directory on the Android device (e.g. '/sdcard/Download/photo.jpg')"),
        localPath: z.string().describe("Target absolute file path on the host computer"),
      },
    },
    async (args) => {
      try {
        const { stdout, stderr } = await executeAdb(["pull", args.remotePath, args.localPath], args.serial);
        // adb pull output is sometimes printed to stderr even on success (transfer progress)
        return formatSuccessResponse(`${stdout || stderr || "File successfully pulled to host."}`);
      } catch (error) {
        return formatErrorResponse(error, "pull_file");
      }
    }
  );
}
