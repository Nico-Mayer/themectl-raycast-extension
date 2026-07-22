import { closeMainWindow, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getPathEntries() {
  switch (process.platform) {
    case "darwin":
      return ["/usr/bin", "/usr/local/bin", "/bin", "/usr/sbin", "/sbin", `${process.env.HOME}/.local/bin`];
    case "linux":
      return ["/usr/local/bin", "/usr/bin", "/bin", `${process.env.HOME}/.local/bin`];
    case "win32":
      return [
        "C:\\Windows\\System32",
        "C:\\Windows",
        process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Programs` : "",
      ].filter(Boolean);
    default:
      return [`${process.env.HOME}/.local/bin`];
  }
}

const pathSeparator = process.platform === "win32" ? ";" : ":";

function buildEnv() {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  process.env.APPDATA = appData;

  return {
    ...process.env,
    PATH: [process.env.PATH, ...getPathEntries()].filter(Boolean).join(pathSeparator),
  };
}

export const env = buildEnv();

export async function runThemectl(args: string[], successTitle: string, loadingTitle?: string) {
  const toast = await showToast({ style: Toast.Style.Animated, title: loadingTitle ?? `${successTitle}…` });
  try {
    await execFileAsync("themectl", args, { env });
    toast.style = Toast.Style.Success;
    toast.title = successTitle;
    await closeMainWindow();
  } catch (error: unknown) {
    console.error("Error executing themectl:", error);
    toast.style = Toast.Style.Failure;
    toast.title = "Error";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}
