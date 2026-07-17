import { Action, ActionPanel, List } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useMemo } from "react";
import { env, runThemectl } from "./utils";

export default function Command() {
  const { data, isLoading } = useExec("themectl", ["ls"], { env, initialData: "" });

  const items = useMemo(
    () =>
      data
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [data],
  );

  return (
    <List isLoading={isLoading}>
      {items.map((item) => (
        <List.Item
          key={item}
          title={item}
          actions={
            <ActionPanel>
              <Action title="Set Theme" onAction={() => runThemectl(["set", item], `Set theme: ${item}`)} />
              <Action.CopyToClipboard content={item} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
