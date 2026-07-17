import { runThemectl } from "./utils";

export default async function Command() {
  await runThemectl(["set", "random", "-d"], "Set dark theme");
}
