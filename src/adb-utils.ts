import { execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Executes an ADB command with the specified arguments.
 * Safe from shell injection on the host because it uses execFile.
 * 
 * @param args Array of arguments to pass to adb.
 * @param serial Optional device serial number to target a specific device.
 * @returns Object containing stdout and stderr.
 */
export async function executeAdb(
  args: string[],
  serial?: string
): Promise<{ stdout: string; stderr: string }> {
  // If a device serial is provided, prefix command arguments with -s <serial>
  const finalArgs = serial ? ["-s", serial, ...args] : args;

  try {
    const { stdout, stderr } = await execFileAsync("adb", finalArgs);
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: any) {
    // If the process exits with a non-zero code, extract the error details
    const errMsg = error.stderr?.trim() || error.stdout?.trim() || error.message || "Unknown ADB error";
    throw new Error(errMsg);
  }
}

/**
 * Runs a command within the device's shell.
 * 
 * @param shellCommand The raw shell command string to run on the Android device.
 * @param serial Optional device serial number to target.
 * @returns Object containing stdout and stderr.
 */
export async function executeAdbShell(
  shellCommand: string,
  serial?: string
): Promise<{ stdout: string; stderr: string }> {
  return executeAdb(["shell", shellCommand], serial);
}

/**
 * Executes an ADB command and writes data to its standard input (stdin).
 * Useful for interactive tools like sqlite3.
 * 
 * @param args Array of arguments to pass to adb.
 * @param stdinContent Data to write to the stdin stream.
 * @param serial Optional device serial number to target.
 * @returns Object containing stdout and stderr.
 */
export function executeAdbWithStdin(
  args: string[],
  stdinContent: string,
  serial?: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const finalArgs = serial ? ["-s", serial, ...args] : args;
    const child = spawn("adb", finalArgs);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      } else {
        const errorMsg = stderr.trim() || stdout.trim() || `Process exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    // Write to stdin and close the stream
    child.stdin.write(stdinContent);
    child.stdin.end();
  });
}

/**
 * Formats a successful response payload for the MCP tool protocol.
 * 
 * @param text The text content to return to the caller.
 * @returns Standard MCP Tool response structure.
 */
export function formatSuccessResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Formats an error response payload for the MCP tool protocol.
 * Catches errors cleanly so the server doesn't crash, allowing the LLM client to see the failure.
 * 
 * @param error The thrown error object.
 * @param toolName The name of the calling tool for context.
 * @returns Standard MCP Tool response structure representing the error.
 */
export function formatErrorResponse(error: any, toolName: string) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[Error in ${toolName}]: ${message}\n`);
  return {
    content: [
      {
        type: "text" as const,
        text: `Error executing ${toolName}: ${message}`,
      },
    ],
    isError: true,
  };
}
