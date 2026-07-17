import { Action, ActionPanel, List } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { env, runThemectl } from "./utils";

export default function Command() {
  const { data, isLoading } = useExec("themectl", ["wall", "list"], { env, initialData: "" });

  const images = data.split("\n");

  return (
    <List isLoading={isLoading} isShowingDetail>
      {images.map((path) => (
        <List.Item
          key={path}
          title={path.split("/").pop() ?? path}
          detail={<List.Item.Detail markdown={`![](${encodeURI(`file://${path}`)})`} />}
          actions={
            <ActionPanel>
              <Action title="Set Theme" onAction={() => runThemectl(["wall", "set", path], `Set Wallpaper: ${path}`)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
