import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { executeAdb, executeAdbShell, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools for taking screenshots, screen recordings, dumpsys info, and system properties.
 * 
 * @param server The MCP server instance.
 */
export function registerDiagnosticTools(server: McpServer): void {
  // 1. Take Screenshot
  server.registerTool(
    "take_screenshot",
    {
      description: "Capture the device screen. If savePath is provided, saves to the host machine. Otherwise, returns the image directly to the client as a renderable PNG image.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        savePath: z.string().optional().describe("Absolute file path on the host to save the screenshot (e.g. '/Users/user/Desktop/screenshot.png')"),
      },
    },
    async (args) => {
      const deviceTempPath = "/sdcard/mcp_screencap_temp.png";
      let hostTempPath = "";
      
      try {
        // Step 1: Capture screenshot on the device
        await executeAdbShell(`screencap -p ${deviceTempPath}`, args.serial);
        
        // Step 2: Determine target host path
        const targetPath = args.savePath || path.join(os.tmpdir(), `screencap_${Date.now()}.png`);
        if (!args.savePath) {
          hostTempPath = targetPath;
        }

        // Step 3: Pull the file to host
        await executeAdb(["pull", deviceTempPath, targetPath], args.serial);

        // Step 4: Handle response based on whether host path was requested or not
        if (args.savePath) {
          return formatSuccessResponse(`Screenshot successfully saved to host: ${args.savePath}`);
        } else {
          // Read pulled file, convert to base64, and return as MCP image content
          const fileBuffer = await fs.readFile(hostTempPath);
          const base64Data = fileBuffer.toString("base64");
          return {
            content: [
              {
                type: "image" as const,
                data: base64Data,
                mimeType: "image/png",
              },
            ],
          };
        }
      } catch (error) {
        return formatErrorResponse(error, "take_screenshot");
      } finally {
        // Cleanup: remove screenshot from the device
        try {
          await executeAdbShell(`rm -f ${deviceTempPath}`, args.serial);
        } catch (cleanupErr) {
          process.stderr.write(`Warning: Failed to clean up device screencap: ${cleanupErr}\n`);
        }
        // Cleanup: remove temporary file on host if we created one
        if (hostTempPath) {
          try {
            await fs.unlink(hostTempPath);
          } catch (cleanupErr) {
            process.stderr.write(`Warning: Failed to clean up host temp screencap: ${cleanupErr}\n`);
          }
        }
      }
    }
  );

  // 2. Record Screen
  server.registerTool(
    "record_screen",
    {
      description: "Record the device screen as an MP4 video for a given duration and save it to the host computer.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        savePath: z.string().describe("Absolute file path on the host to save the MP4 video (e.g. '/Users/user/Desktop/recording.mp4')"),
        duration: z.number().optional().default(10).describe("Recording duration in seconds (1 to 180 seconds, defaults to 10)"),
      },
    },
    async (args) => {
      const deviceTempPath = "/sdcard/mcp_screenrecord_temp.mp4";
      const duration = Math.min(Math.max(args.duration, 1), 180); // clamp between 1 and 180s
      
      try {
        // Step 1: Record on device (screenrecord will auto-exit after the limit)
        await executeAdbShell(`screenrecord --time-limit ${duration} ${deviceTempPath}`, args.serial);

        // Step 2: Pull recording to host
        await executeAdb(["pull", deviceTempPath, args.savePath], args.serial);

        return formatSuccessResponse(`Screen recording (${duration}s) successfully saved to host: ${args.savePath}`);
      } catch (error) {
        return formatErrorResponse(error, "record_screen");
      } finally {
        // Cleanup device video file
        try {
          await executeAdbShell(`rm -f ${deviceTempPath}`, args.serial);
        } catch (cleanupErr) {
          process.stderr.write(`Warning: Failed to clean up device video temp: ${cleanupErr}\n`);
        }
      }
    }
  );

  // 3. Get Dumpsys diagnostics
  server.registerTool(
    "get_dumpsys",
    {
      description: "Retrieve system diagnostic details (dumpsys) for a service or package.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        serviceName: z.string().optional().describe("Service name to dump (e.g. 'battery', 'cpuinfo', 'meminfo', 'window'). Omit to list all available services."),
        packageName: z.string().optional().describe("Filter output for a specific application package (only supported by some dumpsys services like 'package', 'activity', 'meminfo')"),
      },
    },
    async (args) => {
      try {
        let dumpCmd = "dumpsys";
        if (args.serviceName) {
          dumpCmd += ` ${args.serviceName}`;
        } else {
          // If no service is specified, list available services
          dumpCmd += " -l";
        }
        
        if (args.packageName) {
          dumpCmd += ` ${args.packageName}`;
        }

        const { stdout } = await executeAdbShell(dumpCmd, args.serial);
        
        if (!stdout) {
          return formatSuccessResponse("No diagnostic data returned.");
        }
        
        // Truncate if response is excessively long (MCP text limit handling)
        const maxLength = 60000;
        if (stdout.length > maxLength) {
          return formatSuccessResponse(
            stdout.substring(0, maxLength) + "\n\n... [Output truncated due to size limit] ..."
          );
        }

        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "get_dumpsys");
      }
    }
  );

  // 4. Get System Properties
  server.registerTool(
    "get_properties",
    {
      description: "Retrieve system property values (getprop) from the Android device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        propertyName: z.string().optional().describe("Name of the target property (e.g. 'ro.build.version.release', 'ro.product.model'). Omit to return all properties."),
      },
    },
    async (args) => {
      try {
        const cmd = args.propertyName ? `getprop ${args.propertyName}` : "getprop";
        const { stdout } = await executeAdbShell(cmd, args.serial);
        
        if (!stdout) {
          return formatSuccessResponse(args.propertyName ? "Property is empty/not set." : "No properties returned.");
        }

        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "get_properties");
      }
    }
  );

  // 5. Set Mock Location (Emulator/Device location spoofing)
  server.registerTool(
    "set_mock_location",
    {
      description: "Set a mock GPS location (latitude and longitude) on the device. For emulators, this works directly. For physical devices, you must configure a Mock Location App in Developer Options first.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        latitude: z.number().describe("Latitude coordinate (e.g., 37.7749)"),
        longitude: z.number().describe("Longitude coordinate (e.g., -122.4194)"),
      },
    },
    async (args) => {
      try {
        // Try emu geo fix (longitude first, then latitude in adb emu geo fix command syntax)
        const { stdout, stderr } = await executeAdb(
          ["emu", "geo", "fix", String(args.longitude), String(args.latitude)],
          args.serial
        );
        const output = [stdout, stderr].filter(Boolean).join("\n");
        return formatSuccessResponse(
          `Location command sent to emulator: ${output || "Success"}\nCoordinates: Lat ${args.latitude}, Lng ${args.longitude}. (Note: Physical devices require mock location permissions and a provider app.)`
        );
      } catch (error) {
        // Fallback for physical devices: broadcast general android view intent
        try {
          const intentCmd = `am start -a android.intent.action.VIEW -d "geo:${args.latitude},${args.longitude}"`;
          const { stdout } = await executeAdbShell(intentCmd, args.serial);
          return formatSuccessResponse(
            `Location spoof intent broadcasted:\n${stdout}\nCoordinates: Lat ${args.latitude}, Lng ${args.longitude}.\nEnsure your device's mock location provider app is active to intercept this.`
          );
        } catch (innerErr) {
          return formatErrorResponse(error, "set_mock_location");
        }
      }
    }
  );

  // 6. Get App Usage / Screen Time statistics
  server.registerTool(
    "get_app_usage",
    {
      description: "Retrieve app usage and screen time statistics from the device using the usagestats or batterystats services.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().optional().describe("Filter statistics to a specific application package name (e.g. 'com.example.app')"),
        service: z.enum(["usagestats", "batterystats", "procstats"]).optional().default("usagestats").describe("Target system service to dump stats for"),
      },
    },
    async (args) => {
      try {
        let cmd = `dumpsys ${args.service}`;
        if (args.packageName && args.service === "usagestats") {
          cmd += ` ${args.packageName}`;
        }
        
        const { stdout } = await executeAdbShell(cmd, args.serial);
        
        let output = stdout;
        
        // Filter output in JS if querying battery or proc statistics for a single app
        if (args.packageName && args.service !== "usagestats") {
          const lines = stdout.split("\n");
          const filteredLines = lines.filter(line => line.includes(args.packageName!));
          output = filteredLines.length > 0
            ? `Filtered statistics for '${args.packageName}':\n${filteredLines.join("\n")}`
            : `No matching records found for package '${args.packageName}' in service '${args.service}'.`;
        }

        const maxLength = 60000;
        if (output.length > maxLength) {
          output = output.substring(0, maxLength) + "\n\n... [Output truncated due to size limit] ...";
        }

        return formatSuccessResponse(output);
      } catch (error) {
        return formatErrorResponse(error, "get_app_usage");
      }
    }
  );

  // 7. Dump UI Hierarchy XML
  server.registerTool(
    "dump_ui_hierarchy",
    {
      description: "Dump the current layout tree (UI hierarchy XML) of the screen using uiautomator. Highly useful for AI agents to inspect what UI elements are currently visible.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
      },
    },
    async (args) => {
      const deviceTempPath = "/sdcard/mcp_uidump_temp.xml";
      const hostTempPath = path.join(os.tmpdir(), `uidump_${Date.now()}.xml`);
      
      try {
        // Step 1: Dump hierarchy on device
        const dumpResult = await executeAdbShell(`uiautomator dump ${deviceTempPath}`, args.serial);
        
        // If output indicates failure to dump
        if (dumpResult.stdout.includes("ERROR") || dumpResult.stderr.includes("ERROR")) {
          throw new Error(`uiautomator failed to dump screen: ${dumpResult.stdout || dumpResult.stderr}`);
        }

        // Step 2: Pull file to host
        await executeAdb(["pull", deviceTempPath, hostTempPath], args.serial);

        // Step 3: Read and return XML
        const xmlContent = await fs.readFile(hostTempPath, "utf-8");
        return formatSuccessResponse(xmlContent || "UI hierarchy dump was empty.");
      } catch (error) {
        return formatErrorResponse(error, "dump_ui_hierarchy");
      } finally {
        // Cleanup device
        try {
          await executeAdbShell(`rm -f ${deviceTempPath}`, args.serial);
        } catch (cleanupErr) {
          process.stderr.write(`Warning: Failed to clean up device uidump temp: ${cleanupErr}\n`);
        }
        // Cleanup host
        try {
          await fs.unlink(hostTempPath);
        } catch (cleanupErr) {
          // ignore if it doesn't exist
        }
      }
    }
  );

  // 8. Get App Memory Usage (dumpsys meminfo)
  server.registerTool(
    "get_app_memory",
    {
      description: "Dump detailed RAM memory statistics (meminfo) for an app package name.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the target app (e.g. 'com.example.app')"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdbShell(`dumpsys meminfo ${args.packageName}`, args.serial);
        if (!stdout) {
          return formatSuccessResponse("No memory details returned (is the package correct and running?).");
        }
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "get_app_memory");
      }
    }
  );

  // 9. Get CPU Usage
  server.registerTool(
    "get_cpu_usage",
    {
      description: "Retrieve current CPU load statistics from the device shell using dumpsys cpuinfo.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdbShell("dumpsys cpuinfo", args.serial);
        return formatSuccessResponse(stdout || "No CPU statistics returned.");
      } catch (error) {
        return formatErrorResponse(error, "get_cpu_usage");
      }
    }
  );
}
