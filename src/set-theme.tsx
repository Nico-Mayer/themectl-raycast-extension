import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useMemo } from "react";
import { env, runThemectl, themectlPath } from "./utils";

type themeJSON = {
  id: string;
  family: string;
  variant: string;
  appearance: string;
};

export default function Command() {
  const { data, isLoading } = useExec(themectlPath, ["ls", "--json"], { env, initialData: "" });

  const groups = useMemo(() => {
    let items: themeJSON[] = [];
    try {
      items = data ? JSON.parse(data) : [];
    } catch {
      items = [];
    }

    const byAppearance = new Map<string, themeJSON[]>();
    for (const item of items) {
      const list = byAppearance.get(item.appearance) ?? [];
      list.push(item);
      byAppearance.set(item.appearance, list);
    }
    return [...byAppearance.entries()];
  }, [data]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search themes…">
      {groups.map(([appearance, items]) => (
        <List.Section key={appearance} title={appearance} subtitle={`${items.length}`}>
          {items.map((item) => (
            <List.Item
              key={item.id}
              icon={item.appearance === "dark" ? Icon.Moon : Icon.Sun}
              title={item.family}
              subtitle={item.variant}
              keywords={[item.family, item.variant, item.appearance]}
              accessories={[{ tag: item.appearance }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Set Theme"
                    onAction={() => runThemectl(["set", item.id], `Set theme: ${item.id}`, `Setting theme: ${item.id}`)}
                  />
                  <Action.CopyToClipboard title="Copy Theme ID" content={item.id} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
