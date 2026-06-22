import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdb, executeAdbShell, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools related to app installation, listing, running, and managing permissions.
 * 
 * @param server The MCP server instance.
 */
export function registerAppTools(server: McpServer): void {
  // 1. Install app
  server.registerTool(
    "install_app",
    {
      description: "Install an APK from the host machine onto the connected device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        apkPath: z.string().describe("Absolute file path to the APK file on the host machine"),
        reinstall: z.boolean().optional().default(true).describe("Reinstall and keep existing app data (-r flag)"),
        allowDowngrade: z.boolean().optional().default(false).describe("Allow version code downgrade (-d flag)"),
      },
    },
    async (args) => {
      try {
        const installArgs = ["install"];
        if (args.reinstall) installArgs.push("-r");
        if (args.allowDowngrade) installArgs.push("-d");
        installArgs.push(args.apkPath);

        const { stdout } = await executeAdb(installArgs, args.serial);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "install_app");
      }
    }
  );

  // 2. Uninstall app
  server.registerTool(
    "uninstall_app",
    {
      description: "Uninstall an application package from the connected device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("The Android package name of the app to uninstall (e.g. 'com.example.app')"),
        keepData: z.boolean().optional().default(false).describe("Keep the cache and data directories (-k flag)"),
      },
    },
    async (args) => {
      try {
        const uninstallArgs = ["uninstall"];
        if (args.keepData) uninstallArgs.push("-k");
        uninstallArgs.push(args.packageName);

        const { stdout } = await executeAdb(uninstallArgs, args.serial);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "uninstall_app");
      }
    }
  );

  // 3. List installed packages
  server.registerTool(
    "list_packages",
    {
      description: "List all installed application packages on the device, with options to filter by name or package type.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        type: z.enum(["all", "system", "third-party", "enabled", "disabled"]).optional().default("all").describe("Filter by package type"),
        filter: z.string().optional().describe("Substring to filter package names (e.g. 'google')"),
      },
    },
    async (args) => {
      try {
        const pmArgs = ["pm", "list", "packages"];
        
        switch (args.type) {
          case "system":
            pmArgs.push("-s");
            break;
          case "third-party":
            pmArgs.push("-3");
            break;
          case "enabled":
            pmArgs.push("-e");
            break;
          case "disabled":
            pmArgs.push("-d");
            break;
        }

        const { stdout } = await executeAdbShell(pmArgs.join(" "), args.serial);
        
        // Split output into array of packages (strip 'package:' prefix)
        let packages = stdout
          .split("\n")
          .map(line => line.replace(/^package:/, "").trim())
          .filter(line => line.length > 0);

        // Apply string search filter in JS
        if (args.filter) {
          const filterLower = args.filter.toLowerCase();
          packages = packages.filter(pkg => pkg.toLowerCase().includes(filterLower));
        }

        if (packages.length === 0) {
          return formatSuccessResponse("No packages found matching the criteria.");
        }

        return formatSuccessResponse(`Installed Packages (${packages.length}):\n${packages.join("\n")}`);
      } catch (error) {
        return formatErrorResponse(error, "list_packages");
      }
    }
  );

  // 4. Clear application data
  server.registerTool(
    "clear_app_data",
    {
      description: "Delete all data associated with a package (resets app to clean state, clears cache).",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the app (e.g. 'com.example.app')"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdbShell(`pm clear ${args.packageName}`, args.serial);
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "clear_app_data");
      }
    }
  );

  // 5. Force stop app
  server.registerTool(
    "force_stop_app",
    {
      description: "Force stop all processes associated with the application package.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the app to stop"),
      },
    },
    async (args) => {
      try {
        await executeAdbShell(`am force-stop ${args.packageName}`, args.serial);
        return formatSuccessResponse(`App '${args.packageName}' force-stopped successfully.`);
      } catch (error) {
        return formatErrorResponse(error, "force_stop_app");
      }
    }
  );

  // 6. Launch App or App Activity
  server.registerTool(
    "start_app_activity",
    {
      description: "Launch an app or a specific activity on the device. If activity is not provided, launches the default launcher activity.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the app (e.g. 'com.example.app')"),
        activityName: z.string().optional().describe("Full main activity path name (e.g. '.MainActivity' or 'com.example.app/.MainActivity')"),
      },
    },
    async (args) => {
      try {
        if (args.activityName) {
          // If activity is provided, launch via am start
          // Handle shorthand (starts with dot) vs full path
          const component = args.activityName.startsWith(".") 
            ? `${args.packageName}/${args.packageName}${args.activityName}` 
            : args.activityName.includes("/") 
              ? args.activityName 
              : `${args.packageName}/${args.activityName}`;
              
          const { stdout } = await executeAdbShell(`am start -n ${component}`, args.serial);
          return formatSuccessResponse(stdout);
        } else {
          // Otherwise, launch the default launcher activity via monkey tool
          const { stdout } = await executeAdbShell(
            `monkey -p ${args.packageName} -c android.intent.category.LAUNCHER 1`,
            args.serial
          );
          if (stdout.includes("monkey aborted") || stdout.includes("Events injected: 0")) {
            throw new Error("Could not launch default launcher activity. Is the package correct?");
          }
          return formatSuccessResponse(`Launched default launcher activity for package '${args.packageName}'.`);
        }
      } catch (error) {
        return formatErrorResponse(error, "start_app_activity");
      }
    }
  );

  // 7. Grant permission
  server.registerTool(
    "grant_permission",
    {
      description: "Grant a runtime permission to an application package on the device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the app"),
        permission: z.string().describe("Full Android permission name (e.g. 'android.permission.CAMERA')"),
      },
    },
    async (args) => {
      try {
        await executeAdbShell(`pm grant ${args.packageName} ${args.permission}`, args.serial);
        return formatSuccessResponse(`Permission '${args.permission}' successfully granted to '${args.packageName}'.`);
      } catch (error) {
        return formatErrorResponse(error, "grant_permission");
      }
    }
  );

  // 8. Revoke permission
  server.registerTool(
    "revoke_permission",
    {
      description: "Revoke a runtime permission from an application package on the device.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the app"),
        permission: z.string().describe("Full Android permission name (e.g. 'android.permission.CAMERA')"),
      },
    },
    async (args) => {
      try {
        await executeAdbShell(`pm revoke ${args.packageName} ${args.permission}`, args.serial);
        return formatSuccessResponse(`Permission '${args.permission}' successfully revoked from '${args.packageName}'.`);
      } catch (error) {
        return formatErrorResponse(error, "revoke_permission");
      }
    }
  );
}
