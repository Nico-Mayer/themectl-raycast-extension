import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const CLI_VERSION = "0.10.1";
const RELEASE_BASE_URL = "https://github.com/Nico-Mayer/themectl/releases/download";

export type InstallStage =
  "unsupported-platform" | "custom-path" | "download" | "integrity" | "extract" | "permission" | "activation";

export class CliLifecycleError extends Error {
  constructor(
    readonly stage: InstallStage,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CliLifecycleError";
  }
}

export interface CliAsset {
  filename: string;
  sha256: string;
}

export const CLI_ASSETS: Readonly<Record<string, CliAsset>> = {
  "darwin-x64": {
    filename: "themectl_0.10.1_darwin_amd64.tar.gz",
    sha256: "085adac4756812593d34fcd49bc9defbc2d3b9fb333dab3515dc4eb87f9e31fb",
  },
  "darwin-arm64": {
    filename: "themectl_0.10.1_darwin_arm64.tar.gz",
    sha256: "e1beb99db9ec9bb3c60ec239c1f8c8a9e672b191b8facbb2941be0c874ba3518",
  },
  "win32-x64": {
    filename: "themectl_0.10.1_windows_amd64.zip",
    sha256: "13be7e73ae07d4d9db300bf81468f49c2151ebe8de8d20e73c2dd739e67b0bad",
  },
  "win32-arm64": {
    filename: "themectl_0.10.1_windows_arm64.zip",
    sha256: "7c2e24671120363f804a45e06fb4d1484e4c00a9f47dae4fa5e47dc109c36d08",
  },
};

export function platformKey(platform = process.platform, arch = process.arch): string {
  return `${platform}-${arch}`;
}

export function getCliAsset(platform = process.platform, arch = process.arch): CliAsset {
  const key = platformKey(platform, arch);
  const asset = CLI_ASSETS[key];
  if (!asset) {
    throw new CliLifecycleError("unsupported-platform", `Themectl does not support ${key}.`);
  }
  return asset;
}

export function normalizeCustomPath(
  value: string | undefined,
  platform = process.platform,
  home = os.homedir(),
): string {
  let customPath = value?.trim() ?? "";
  if (!customPath) return "";

  if (customPath.startsWith('"') && customPath.endsWith('"')) customPath = customPath.slice(1, -1);
  if (customPath === "~" || customPath.startsWith("~/") || customPath.startsWith("~\\")) {
    customPath = path.join(home, customPath.slice(1));
  }
  if (platform === "win32" && path.extname(customPath) === "") customPath += ".exe";
  return customPath;
}

export function buildCliEnv(
  platform = process.platform,
  sourceEnv: NodeJS.ProcessEnv = process.env,
  home = os.homedir(),
): NodeJS.ProcessEnv {
  if (platform !== "win32") return sourceEnv;
  return {
    ...sourceEnv,
    APPDATA: sourceEnv.APPDATA ?? path.join(home, "AppData", "Roaming"),
    LOCALAPPDATA: sourceEnv.LOCALAPPDATA ?? path.join(home, "AppData", "Local"),
  };
}

export function managedCliDirectory(supportPath: string, version = CLI_VERSION): string {
  return path.join(supportPath, "cli", version);
}

export function managedCliPath(supportPath: string, version = CLI_VERSION, platform = process.platform): string {
  return path.join(managedCliDirectory(supportPath, version), platform === "win32" ? "themectl.exe" : "themectl");
}

export function releaseUrl(asset: CliAsset, version = CLI_VERSION): string {
  return `${RELEASE_BASE_URL}/v${version}/${asset.filename}`;
}

export function archiveCommand(
  archivePath: string,
  destination: string,
  platform = process.platform,
): { command: string; args: string[] } {
  return {
    command: platform === "win32" ? "tar.exe" : "/usr/bin/tar",
    args: ["-xf", archivePath, "-C", destination],
  };
}

export interface InstallProgress {
  stage: "download" | "integrity" | "extract" | "activation";
  message: string;
}

type FetchResponse = Pick<Response, "ok" | "status" | "statusText" | "arrayBuffer">;

export interface EnsureManagedCliOptions {
  supportPath: string;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  version?: string;
  asset?: CliAsset;
  fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<FetchResponse>;
  extractFn?: (archivePath: string, destination: string, platform: NodeJS.Platform) => Promise<void>;
  onProgress?: (progress: InstallProgress) => void | Promise<void>;
}

const installs = new Map<string, Promise<string>>();

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutableFile(filePath: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    const details = await stat(filePath);
    if (!details.isFile()) return false;
    await access(filePath, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function defaultExtract(archivePath: string, destination: string, platform: NodeJS.Platform): Promise<void> {
  const { command, args } = archiveCommand(archivePath, destination, platform);
  await execFileAsync(command, args);
}

const ABANDONED_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function reapAbandonedTemporaryDirectories(cliRoot: string): Promise<void> {
  const temporaryDirectory = path.join(cliRoot, ".tmp");
  try {
    const entries = await readdir(temporaryDirectory, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) return;
        const entryPath = path.join(temporaryDirectory, entry.name);
        const details = await stat(entryPath);
        if (now - details.mtimeMs > ABANDONED_TEMP_MAX_AGE_MS) {
          await rm(entryPath, { recursive: true, force: true });
        }
      }),
    );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      console.warn("Could not clean abandoned Themectl installation files:", error);
    }
  }
}

async function installManagedCli(options: EnsureManagedCliOptions): Promise<string> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const version = options.version ?? CLI_VERSION;
  const asset = options.asset ?? getCliAsset(platform, arch);
  const targetDirectory = managedCliDirectory(options.supportPath, version);
  const targetPath = managedCliPath(options.supportPath, version, platform);

  if (await pathExists(targetPath)) return targetPath;

  const cliRoot = path.join(options.supportPath, "cli");
  const temporaryRoot = path.join(cliRoot, ".tmp", randomUUID());
  const preparedDirectory = path.join(temporaryRoot, "prepared");
  const archivePath = path.join(temporaryRoot, asset.filename);
  const fetchFn = options.fetchFn ?? fetch;
  const extractFn = options.extractFn ?? defaultExtract;
  const progress = options.onProgress ?? (() => undefined);

  try {
    try {
      await mkdir(preparedDirectory, { recursive: true });
      await reapAbandonedTemporaryDirectories(cliRoot);
    } catch (error) {
      throw new CliLifecycleError("permission", "Could not prepare Themectl installation storage.", { cause: error });
    }
    await progress({ stage: "download", message: `Downloading Themectl ${version}…` });

    let response: FetchResponse;
    try {
      response = await fetchFn(releaseUrl(asset, version));
    } catch (error) {
      throw new CliLifecycleError("download", "Could not connect to GitHub Releases.", { cause: error });
    }
    if (!response.ok) {
      throw new CliLifecycleError("download", `GitHub Releases returned HTTP ${response.status}.`);
    }

    let archive: Buffer;
    try {
      archive = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new CliLifecycleError("download", "Could not read the Themectl download.", { cause: error });
    }
    try {
      await writeFile(archivePath, archive);
    } catch (error) {
      throw new CliLifecycleError("permission", "Could not save the Themectl archive.", { cause: error });
    }

    await progress({ stage: "integrity", message: "Verifying download…" });
    const actualHash = createHash("sha256").update(archive).digest("hex");
    if (actualHash !== asset.sha256) {
      throw new CliLifecycleError("integrity", "Downloaded archive failed SHA-256 verification.");
    }

    await progress({ stage: "extract", message: "Extracting Themectl…" });
    try {
      await extractFn(archivePath, preparedDirectory, platform);
    } catch (error) {
      const permissionDenied = error instanceof Error && "code" in error && error.code === "EACCES";
      throw new CliLifecycleError(
        permissionDenied ? "permission" : "extract",
        permissionDenied
          ? "Could not write the managed Themectl executable."
          : "Could not extract the Themectl archive.",
        { cause: error },
      );
    }

    const preparedPath = path.join(preparedDirectory, platform === "win32" ? "themectl.exe" : "themectl");
    if (!(await pathExists(preparedPath))) {
      throw new CliLifecycleError("extract", "The Themectl archive did not contain the expected executable.");
    }

    if (platform !== "win32") {
      try {
        await chmod(preparedPath, 0o755);
      } catch (error) {
        throw new CliLifecycleError("permission", "Could not make Themectl executable.", { cause: error });
      }
    }

    await progress({ stage: "activation", message: "Activating Themectl…" });
    try {
      await mkdir(cliRoot, { recursive: true });
    } catch (error) {
      throw new CliLifecycleError("permission", "Could not prepare Themectl installation storage.", { cause: error });
    }
    try {
      await rename(preparedDirectory, targetDirectory);
    } catch (error) {
      if (!(await pathExists(targetPath))) {
        const permissionDenied = error instanceof Error && "code" in error && error.code === "EACCES";
        throw new CliLifecycleError(
          permissionDenied ? "permission" : "activation",
          permissionDenied
            ? "Could not write the managed Themectl installation."
            : "Could not activate the managed Themectl executable.",
          { cause: error },
        );
      }
    }

    return targetPath;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function ensureManagedCli(options: EnsureManagedCliOptions): Promise<string> {
  const targetPath = managedCliPath(
    options.supportPath,
    options.version ?? CLI_VERSION,
    options.platform ?? process.platform,
  );
  const existing = installs.get(targetPath);
  if (existing) return existing;

  const installation = installManagedCli(options).finally(() => installs.delete(targetPath));
  installs.set(targetPath, installation);
  return installation;
}

export interface ResolveCliOptions extends EnsureManagedCliOptions {
  customPath?: string;
  home?: string;
  ensureManaged?: (options: EnsureManagedCliOptions) => Promise<string>;
}

export async function resolveCli(options: ResolveCliOptions): Promise<string> {
  const platform = options.platform ?? process.platform;
  const customPath = normalizeCustomPath(options.customPath, platform, options.home);
  if (customPath) {
    if (!(await isExecutableFile(customPath, platform))) {
      throw new CliLifecycleError("custom-path", `No executable file is available at ${customPath}.`);
    }
    return customPath;
  }

  const ensureManaged = options.ensureManaged ?? ensureManagedCli;
  return ensureManaged(options);
}

export async function executeResolvedCli<T>(
  args: string[],
  resolve: () => Promise<string>,
  execute: (executable: string, args: string[]) => Promise<T>,
): Promise<T> {
  const executable = await resolve();
  return execute(executable, args);
}
