import {
  closeMainWindow,
  environment,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildCliEnv, executeResolvedCli, InstallProgress, resolveCli } from "./cli";
import { presentThemectlError } from "./errors";

const execFileAsync = promisify(execFile);

type ThemectlPreferences = {
  themectlPath?: string;
};

export const env = buildCliEnv();

export async function resolveThemectlPath(onProgress?: (progress: InstallProgress) => void | Promise<void>) {
  const { themectlPath } = getPreferenceValues<ThemectlPreferences>();
  return resolveCli({
    customPath: themectlPath,
    supportPath: environment.supportPath,
    onProgress,
  });
}

export async function executeThemectl(
  args: string[],
  onProgress?: (progress: InstallProgress) => void | Promise<void>,
) {
  return executeResolvedCli(
    args,
    () => resolveThemectlPath(onProgress),
    (executable, resolvedArgs) => execFileAsync(executable, resolvedArgs, { env }),
  );
}

export async function showThemectlError(error: unknown) {
  console.error("Themectl error:", error);
  const presentation = presentThemectlError(error);
  const toast = await showToast({
    style: Toast.Style.Failure,
    title: presentation.title,
    message: presentation.message,
  });
  if (presentation.openPreferences) {
    toast.primaryAction = { title: "Open Extension Settings", onAction: openExtensionPreferences };
  }
}

export async function runThemectl(args: string[], successTitle: string, loadingTitle?: string) {
  const toast = await showToast({ style: Toast.Style.Animated, title: loadingTitle ?? `${successTitle}…` });
  try {
    await executeThemectl(args, ({ message }) => {
      toast.message = message;
    });
    toast.style = Toast.Style.Success;
    toast.title = successTitle;
    toast.message = undefined;
    await closeMainWindow();
  } catch (error: unknown) {
    console.error("Themectl error:", error);
    const presentation = presentThemectlError(error);
    toast.style = Toast.Style.Failure;
    toast.title = presentation.title;
    toast.message = presentation.message;
    if (presentation.openPreferences) {
      toast.primaryAction = { title: "Open Extension Settings", onAction: openExtensionPreferences };
    }
  }
}
