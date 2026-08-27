import { closeMainWindow, getPreferenceValues, openExtensionPreferences, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function resolveThemectlPath(): string {
  let p = getPreferenceValues<Preferences>().themectlPath.trim();
  // Windows "Copy as path" wraps the path in quotes
  if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) p = path.join(os.homedir(), p.slice(1));
  if (process.platform === "win32" && path.extname(p) === "") p += ".exe";
  return p;
}

export const themectlPath = resolveThemectlPath();

function buildEnv(): NodeJS.ProcessEnv {
  if (process.platform !== "win32") return process.env;
  // themectl resolves its config dir from these; Raycast may launch without them set.
  return {
    ...process.env,
    APPDATA: process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
    LOCALAPPDATA: process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
  };
}

export const env = buildEnv();

export async function runThemectl(args: string[], successTitle: string, loadingTitle?: string) {
  const toast = await showToast({ style: Toast.Style.Animated, title: loadingTitle ?? `${successTitle}…` });
  try {
    await execFileAsync(themectlPath, args, { env });
    toast.style = Toast.Style.Success;
    toast.title = successTitle;
    await closeMainWindow();
  } catch (error: unknown) {
    console.error("Error executing themectl:", error);
    toast.style = Toast.Style.Failure;
    const notFound = error instanceof Error && "code" in error && error.code === "ENOENT";
    toast.title = notFound ? "Themectl not found" : "Error";
    toast.message = notFound
      ? `No executable at ${themectlPath} — check the path in the extension settings`
      : error instanceof Error
        ? error.message
        : String(error);
    toast.primaryAction = { title: "Open Extension Settings", onAction: openExtensionPreferences };
  }
}
