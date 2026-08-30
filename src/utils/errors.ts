import { CliLifecycleError } from "./cli";

export interface ErrorPresentation {
  title: string;
  message: string;
  openPreferences: boolean;
}

export function presentThemectlError(error: unknown): ErrorPresentation {
  if (error instanceof CliLifecycleError) {
    switch (error.stage) {
      case "unsupported-platform":
        return { title: "Unsupported platform", message: error.message, openPreferences: false };
      case "custom-path":
        return { title: "Invalid Themectl path", message: error.message, openPreferences: true };
      case "download":
        return { title: "Themectl download failed", message: error.message, openPreferences: false };
      case "integrity":
        return {
          title: "Themectl verification failed",
          message: "Downloaded archive did not match the pinned checksum.",
          openPreferences: false,
        };
      case "extract":
        return { title: "Themectl extraction failed", message: error.message, openPreferences: false };
      case "permission":
        return { title: "Themectl permission failed", message: error.message, openPreferences: false };
      case "activation":
        return { title: "Themectl installation failed", message: error.message, openPreferences: false };
    }
  }

  return {
    title: "Themectl command failed",
    message: error instanceof Error ? error.message : String(error),
    openPreferences: false,
  };
}
