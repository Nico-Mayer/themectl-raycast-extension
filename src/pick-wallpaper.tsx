import { Action, ActionPanel, Grid } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useMemo } from "react";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { env, runThemectl } from "./utils";

export default function Command() {
  const { data, isLoading } = useExec("themectl", ["wall", "list"], { env, initialData: "" });

  const images = useMemo(() => {
    const seen = new Set<string>();
    return data
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
