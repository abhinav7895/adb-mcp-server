import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAdbShell, executeAdbWithStdin, formatSuccessResponse, formatErrorResponse } from "../adb-utils.js";

/**
 * Registers tools for database diagnostics and querying SQLite databases within sandboxed apps.
 * 
 * @param server The MCP server instance.
 */
export function registerDatabaseTools(server: McpServer): void {
  // 1. Get database statistics via dumpsys dbinfo
  server.registerTool(
    "get_dbinfo",
    {
      description: "Retrieve SQLite database statistics and diagnostics for running apps using dumpsys dbinfo. Optionally filter by application package.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().optional().describe("Filter output to a specific application package (e.g. 'com.example.app')"),
        verbose: z.boolean().optional().default(false).describe("Include detailed/verbose connection details (-v flag)"),
      },
    },
    async (args) => {
      try {
        let cmd = "dumpsys dbinfo";
        if (args.verbose) {
          cmd += " -v";
        }
        if (args.packageName) {
          cmd += ` ${args.packageName}`;
        }

        const { stdout } = await executeAdbShell(cmd, args.serial);
        
        if (!stdout) {
          return formatSuccessResponse("No database diagnostics returned (is the app currently running?).");
        }

        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "get_dbinfo");
      }
    }
  );

  // 2. Query SQLite database
  server.registerTool(
    "query_sqlite",
    {
      description: "Execute a SQL query/command on a SQLite database within an app's sandboxed data directory. Note: Only works on debuggable apps or rooted devices/emulators.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the target app (e.g. 'com.example.app')"),
        dbName: z.string().describe("Database filename (e.g. 'local_cache.db') or absolute path within the sandbox (e.g. '/data/data/com.example.app/databases/main.db')"),
        query: z.string().describe("The SQL query/command to execute (e.g. 'SELECT * FROM users LIMIT 10;', '.tables', '.schema')"),
      },
    },
    async (args) => {
      try {
        // Resolve database path. If it contains a slash, assume it is an absolute path.
        // Otherwise, prepend 'databases/' which is the standard sub-folder for run-as execution.
        const dbPath = args.dbName.includes("/") ? args.dbName : `databases/${args.dbName}`;
        
        // Construct standard arguments for calling run-as sqlite3
        // Passing -header and -column flags to SQLite makes stdout tabular and human-readable!
        const adbArgs = [
          "shell",
          `run-as ${args.packageName} sqlite3 -header -column ${dbPath}`
        ];

        // Append a trailing semicolon to SQL queries if it is missing and it's a standard query (not a dot command)
        let formattedQuery = args.query.trim();
        if (!formattedQuery.startsWith(".") && !formattedQuery.endsWith(";")) {
          formattedQuery += ";";
        }

        // Execute and pipe the query via stdin
        const { stdout, stderr } = await executeAdbWithStdin(adbArgs, formattedQuery, args.serial);

        if (stderr) {
          throw new Error(stderr);
        }

        if (!stdout) {
          return formatSuccessResponse("Query executed successfully. (Empty result set)");
        }

        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "query_sqlite");
      }
    }
  );

  // 3. List Shared Preferences Files
  server.registerTool(
    "list_shared_preferences",
    {
      description: "List all Shared SharedPreferences (preferences XML files) inside an application sandbox. Requires a debuggable app or root.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the target app (e.g. 'com.example.app')"),
      },
    },
    async (args) => {
      try {
        const { stdout } = await executeAdbShell(`run-as ${args.packageName} ls shared_prefs`, args.serial);
        if (!stdout) {
          return formatSuccessResponse("No Shared Preferences files found or directory doesn't exist.");
        }
        return formatSuccessResponse(`Shared Preferences files for '${args.packageName}':\n${stdout}`);
      } catch (error) {
        return formatErrorResponse(error, "list_shared_preferences");
      }
    }
  );

  // 4. Get Shared Preferences XML content
  server.registerTool(
    "get_shared_preferences",
    {
      description: "Retrieve and read the XML contents of a specific Shared Preferences file inside an app's sandbox. Requires a debuggable app or root.",
      inputSchema: {
        serial: z.string().optional().describe("Specific device serial number"),
        packageName: z.string().describe("Package name of the target app (e.g. 'com.example.app')"),
        filename: z.string().describe("Filename of the preferences file (e.g. 'app_settings' or 'app_settings.xml')"),
      },
    },
    async (args) => {
      try {
        let name = args.filename.trim();
        if (!name.endsWith(".xml")) {
          name += ".xml";
        }
        const { stdout } = await executeAdbShell(`run-as ${args.packageName} cat shared_prefs/${name}`, args.serial);
        if (!stdout) {
          return formatSuccessResponse("File is empty.");
        }
        return formatSuccessResponse(stdout);
      } catch (error) {
        return formatErrorResponse(error, "get_shared_preferences");
      }
    }
  );
}
