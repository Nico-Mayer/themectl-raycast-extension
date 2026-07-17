import { runThemectl } from "./utils";

export default async function Command() {
  await runThemectl(["wall", "set", "-r"], "Set wallpaper");
}
