import { closeMainWindow, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const themectlPath = getPreferenceValues<Preferences>().themectlPath;

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
    toast.title = "Error";
    toast.message = error instanceof Error ? error.message : String(error);
  }
}
