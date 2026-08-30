import { Action, ActionPanel, Grid } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useMemo } from "react";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { executeThemectl, runThemectl, showThemectlError } from "./utils";

async function listWallpapers() {
  return executeThemectl(["wall", "list"]);
}

export default function Command() {
  const { data, isLoading } = usePromise(listWallpapers, [], {
    onError(error) {
      void showThemectlError(error);
    },
  });

  const images = useMemo(() => {
    const seen = new Set<string>();
    return (data?.stdout ?? "")
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p && !seen.has(p) && seen.add(p));
  }, [data]);

  return (
    <Grid
      isLoading={isLoading}
      columns={4}
      aspectRatio="16/9"
      fit={Grid.Fit.Fill}
      searchBarPlaceholder="Search wallpapers…"
    >
      {images.map((imagePath) => {
        const name = path.basename(imagePath, path.extname(imagePath));
        return (
          <Grid.Item
            key={imagePath}
            content={{ source: pathToFileURL(imagePath).href }}
            title={name}
            keywords={[name]}
            actions={
              <ActionPanel>
                <Action
                  title="Set Wallpaper"
                  onAction={() =>
                    runThemectl(["wall", "set", imagePath], `Set wallpaper: ${name}`, `Setting wallpaper: ${name}`)
                  }
                />
                <Action.CopyToClipboard title="Copy Path" content={imagePath} />
                <Action.ShowInFinder path={imagePath} />
              </ActionPanel>
            }
          />
        );
      })}
    </Grid>
  );
}
