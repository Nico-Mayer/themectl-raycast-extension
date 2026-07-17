import { Action, ActionPanel, List } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { env, runThemectl } from "./utils";
import path from "path";
import { pathToFileURL } from "url";

export default function Command() {
  const { data, isLoading } = useExec("themectl", ["wall", "list"], {
    env,
    initialData: "",
  });

  const images = data
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <List isLoading={isLoading} isShowingDetail>
      {images.map((imagePath) => (
        <List.Item
          key={imagePath}
          title={path.basename(imagePath)}
          detail={<List.Item.Detail markdown={`![](${pathToFileURL(imagePath).href})`} />}
          actions={
            <ActionPanel>
              <Action
                title="Set Theme"
                onAction={() => runThemectl(["wall", "set", imagePath], `Set Wallpaper: ${imagePath}`)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
