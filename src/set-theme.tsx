import { Action, ActionPanel, List, closeMainWindow, showToast, Toast } from "@raycast/api";
import { execFile } from "child_process";
import { useEffect, useState } from "react";

function getPathEntries() {
  switch (process.platform) {
    case "darwin":
      return ["/usr/bin", "/bin", "/usr/sbin", "/sbin", `${process.env.HOME}/.local/bin`];
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

const env = {
  ...process.env,
  PATH: [process.env.PATH, ...getPathEntries()].filter(Boolean).join(pathSeparator),
};

function setTheme(theme: string) {
  execFile("huectl", ["set", theme], { env }, async (error, _stdout, stderr) => {
    if (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to set theme",
        message: stderr || error.message,
      });
      return;
    }

    await closeMainWindow();
    await showToast({
      style: Toast.Style.Success,
      title: `Set theme: ${theme}`,
    });
  });
}

export default function Command() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    execFile("huectl", ["ls"], { env }, (error, stdout) => {
      if (error) return;

      setItems(
        stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      );
    });
  }, []);

  return (
    <List>
      {items.map((item) => (
        <List.Item
          key={item}
          title={item}
          actions={
            <ActionPanel>
              <Action title="Set Theme" onAction={() => setTheme(item)} />
              <Action.CopyToClipboard content={item} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
