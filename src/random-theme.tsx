import { execFile } from "child_process";
import { promisify } from "util";
import { closeMainWindow, showToast, Toast } from "@raycast/api";
import { getEnv } from "./utils";

const execFileAsync = promisify(execFile);

export default async function Command() {
  try {
    await execFileAsync("themectl", ["set", "random"], { env: getEnv() });

    await closeMainWindow();
    await showToast({
      style: Toast.Style.Success,
      title: "Set theme",
    });
  } catch (error: unknown) {
    console.error("Error executing themectl:", error);

    await closeMainWindow();
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
