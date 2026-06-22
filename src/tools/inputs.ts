import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdbShell, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools to simulate hardware and touch inputs on the Android device.
 * 
 * @param server The MCP server instance.
 */
export function registerInputTools(server: McpServer): void {
  // 1. Send Keyevent
  server.registerTool(
    "send_keyevent",
    {
      description: "Send a keyevent (hardware/system key simulation) to the device (e.g. BACK=4, HOME=3, POWER=26, APP_SWITCH=187).",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        keycode: z.number().describe("The Android keyevent integer code (e.g., Back=4, Home=3, Power=26, Tab=61, Enter=66)"),
      },
    },
    async (args) => {
      try {
        await executeAdbShell(`input keyevent ${args.keycode}`, args.serial);
        return formatSuccessResponse(`Keyevent ${args.keycode} sent to device.`);
      } catch (error) {
        return formatErrorResponse(error, "send_keyevent");
      }
    }
  );

  // 2. Tap Screen
  server.registerTool(
    "tap_screen",
    {
      description: "Tap the screen at specific X and Y coordinates.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        x: z.number().describe("X coordinate (pixels)"),
        y: z.number().describe("Y coordinate (pixels)"),
      },
    },
    async (args) => {
      try {
        await executeAdbShell(`input tap ${args.x} ${args.y}`, args.serial);
        return formatSuccessResponse(`Tapped screen at coordinate (${args.x}, ${args.y}).`);
      } catch (error) {
        return formatErrorResponse(error, "tap_screen");
      }
    }
  );

  // 3. Swipe Screen
  server.registerTool(
    "swipe_screen",
    {
      description: "Swipe from starting coordinates to ending coordinates, with an optional duration parameter to simulate drag actions.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        x1: z.number().describe("Starting X coordinate (pixels)"),
        y1: z.number().describe("Starting Y coordinate (pixels)"),
        x2: z.number().describe("Ending X coordinate (pixels)"),
        y2: z.number().describe("Ending Y coordinate (pixels)"),
        duration: z.number().optional().describe("Swipe gesture duration in milliseconds (optional, e.g. 500)"),
      },
    },
    async (args) => {
      try {
        let cmd = `input swipe ${args.x1} ${args.y1} ${args.x2} ${args.y2}`;
        if (args.duration) {
          cmd += ` ${args.duration}`;
        }
        await executeAdbShell(cmd, args.serial);
        return formatSuccessResponse(`Swiped screen from (${args.x1}, ${args.y1}) to (${args.x2}, ${args.y2}).`);
      } catch (error) {
        return formatErrorResponse(error, "swipe_screen");
      }
    }
  );

  // 4. Type Text
  server.registerTool(
    "type_text",
    {
      description: "Type text into the currently focused input field. Automatically formats space characters for compatibility with the adb shell.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        text: z.string().describe("The text string to type into the focused field"),
      },
    },
    async (args) => {
      try {
        // ADB input text treats spaces specially. We replace space with %s, which is the standard escaping for input text.
        const escapedText = args.text.replace(/ /g, "%s");
        await executeAdbShell(`input text "${escapedText}"`, args.serial);
        return formatSuccessResponse(`Typed text '${args.text}' onto device.`);
      } catch (error) {
        return formatErrorResponse(error, "type_text");
      }
    }
  );
}
