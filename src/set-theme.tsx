import { Action, ActionPanel, List, closeMainWindow, showToast, Toast } from "@raycast/api";
import { execFile } from "child_process";
import { useEffect, useState } from "react";
import { getEnv } from "./utils";

const env = getEnv();

function setTheme(theme: string) {
  execFile("themectl", ["set", theme], { env }, async (error, _stdout, stderr) => {
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
    execFile("themectl", ["ls"], { env }, (error, stdout) => {
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
