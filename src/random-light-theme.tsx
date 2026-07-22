import { runThemectl } from "./utils";

export default async function Command() {
  await runThemectl(["set", "random", "-l"], "Set light theme", "Setting random light theme");
}
