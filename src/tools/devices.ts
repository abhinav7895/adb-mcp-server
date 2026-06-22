import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdb, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools related to device connection, discovery, and basic state management.
 * 
 * @param server The MCP server instance.
 */
export function registerDeviceTools(server: McpServer): void {
  // 1. List connected devices
  server.registerTool(
    "list_devices",
    {
      description: "List all connected Android devices and emulators, including their serial numbers, connection status, and details (product, model, device, transport).",
      inputSchema: {},
    },
    async () => {
      try {
        const { stdout } = await executeAdb(["devices", "-l"]);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "list_devices");
      }
    }
  );

  // 2. Connect to a device over Wi-Fi
  server.registerTool(
    "connect_device",
    {
      description: "Connect to an Android device over TCP/IP (Wi-Fi) using its IP address and optional port.",
      inputSchema: {
        host: z.string().describe("The IP address or hostname of the target device (e.g. '192.168.1.100')"),
        port: z.number().optional().describe("The TCP port to connect to (defaults to 5555)"),
      },
    },
    async (args) => {
      try {
        const target = args.port ? `${args.host}:${args.port}` : args.host;
        const { stdout } = await executeAdb(["connect", target]);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "connect_device");
      }
    }
  );

  // 3. Disconnect from a Wi-Fi device
  server.registerTool(
    "disconnect_device",
    {
      description: "Disconnect from a previously connected TCP/IP (Wi-Fi) device.",
      inputSchema: {
        host: z.string().describe("The IP address or hostname of the device to disconnect from"),
        port: z.number().optional().describe("The TCP port of the device (defaults to 5555)"),
      },
    },
    async (args) => {
      try {
        const target = args.port ? `${args.host}:${args.port}` : args.host;
        const { stdout } = await executeAdb(["disconnect", target]);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "disconnect_device");
      }
    }
  );

  // 4. Get device state
  server.registerTool(
    "get_device_state",
    {
      description: "Get the current state of a connected device (e.g. offline, bootloader, device).",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number (optional if only one device is connected)"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdb(["get-state"], args.serial);
        return formatSuccessResponse(`Device State: ${stdout}`);
      } catch (error) {
        return formatErrorResponse(error, "get_device_state");
      }
    }
  );

  // 5. Reboot device
  server.registerTool(
    "reboot_device",
    {
      description: "Reboot the connected device into different modes: system, bootloader, recovery, or sideload.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number (optional if only one device is connected)"),
        mode: z.enum(["system", "bootloader", "recovery", "sideload"]).optional().default("system").describe("Reboot mode target"),
      },
    },
    async (args) => {
      try {
        const rebootArgs = ["reboot"];
        if (args.mode && args.mode !== "system") {
          rebootArgs.push(args.mode);
        }
        const { stdout } = await executeAdb(rebootArgs, args.serial);
        return formatSuccessResponse(stdout || `Rebooting device (${args.mode}) initiated.`);
      } catch (error) {
        return formatErrorResponse(error, "reboot_device");
      }
    }
  );

  // 6. Restart ADB daemon with root permissions
  server.registerTool(
    "root_device",
    {
      description: "Restart the adbd daemon on the device with root permissions. Note: Only works on userdebug/eng builds or rooted devices.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number (optional if only one device is connected)"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdb(["root"], args.serial);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "root_device");
      }
    }
  );

  // 7. Restart ADB daemon without root permissions
  server.registerTool(
    "unroot_device",
    {
      description: "Restart the adbd daemon on the device without root permissions (restores non-root privileges).",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number (optional if only one device is connected)"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdb(["unroot"], args.serial);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "unroot_device");
      }
    }
  );

  // 8. Forward Port (Host to Device)
  server.registerTool(
    "forward_port",
    {
      description: "Forward socket connections from a local host port to a port on the connected device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        local: z.string().describe("Local host socket specification (e.g. 'tcp:8080')"),
        remote: z.string().describe("Remote device socket specification (e.g. 'tcp:8080')"),
        noRebind: z.boolean().optional().default(false).describe("Fail if the local socket is already bound (--no-rebind flag)"),
      },
    },
    async (args) => {
      try {
        const forwardArgs = ["forward"];
        if (args.noRebind) {
          forwardArgs.push("--no-rebind");
        }
        forwardArgs.push(args.local, args.remote);

        const { stdout } = await executeAdb(forwardArgs, args.serial);
        return formatSuccessResponse(stdout || `Successfully forwarded host ${args.local} to device ${args.remote}`);
      } catch (error) {
        return formatErrorResponse(error, "forward_port");
      }
    }
  );

  // 9. Reverse Port (Device to Host)
  server.registerTool(
    "reverse_port",
    {
      description: "Reverse socket connections from a port on the device to a port on the local host (critical for React Native bundler reverse tcp:8081).",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        remote: z.string().describe("Remote device socket specification (e.g. 'tcp:8081')"),
        local: z.string().describe("Local host socket specification (e.g. 'tcp:8081')"),
        noRebind: z.boolean().optional().default(false).describe("Fail if the remote socket is already bound (--no-rebind flag)"),
      },
    },
    async (args) => {
      try {
        const reverseArgs = ["reverse"];
        if (args.noRebind) {
          reverseArgs.push("--no-rebind");
        }
        reverseArgs.push(args.remote, args.local);

        const { stdout } = await executeAdb(reverseArgs, args.serial);
        return formatSuccessResponse(stdout || `Successfully reversed device ${args.remote} to host ${args.local}`);
      } catch (error) {
        return formatErrorResponse(error, "reverse_port");
      }
    }
  );

  // 10. List Forward Ports
  server.registerTool(
    "list_forwards",
    {
      description: "List all active port forwarding connections from host to device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdb(["forward", "--list"], args.serial);
        return formatSuccessResponse(stdout || "No active port forwards found.");
      } catch (error) {
        return formatErrorResponse(error, "list_forwards");
      }
    }
  );

  // 11. List Reverse Ports
  server.registerTool(
    "list_reverses",
    {
      description: "List all active reverse port connections from device to host.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdb(["reverse", "--list"], args.serial);
        return formatSuccessResponse(stdout || "No active reverse port forwards found.");
      } catch (error) {
        return formatErrorResponse(error, "list_reverses");
      }
    }
  );
}
