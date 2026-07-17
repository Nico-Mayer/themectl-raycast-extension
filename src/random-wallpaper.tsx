import { runThemectl } from "./utils";

export default async function Command() {
  await runThemectl(["wall", "-r"], "Set wallpaper");
}
