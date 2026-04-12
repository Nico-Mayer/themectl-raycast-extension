function getPathEntries() {
  switch (process.platform) {
    case "darwin":
      return ["/usr/bin", "/bin", "/usr/sbin", "/sbin", `${process.env.HOME}/.local/bin`];
    case "linux":
      return ["/usr/local/bin", "/usr/bin", "/bin", `${process.env.HOME}/.local/bin`];
    case "win32":
      return [
        "C:\\Windows\\System32",
        "C:\\Windows",
        process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Programs` : "",
      ].filter(Boolean);
    default:
      return [`${process.env.HOME}/.local/bin`];
  }
}

const pathSeparator = process.platform === "win32" ? ";" : ":";

const env = {
  ...process.env,
  PATH: [process.env.PATH, ...getPathEntries()].filter(Boolean).join(pathSeparator),
};

export function getEnv() {
  return env;
}
