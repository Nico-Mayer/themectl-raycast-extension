import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  archiveCommand,
  buildCliEnv,
  CLI_ASSETS,
  CLI_VERSION,
  CliAsset,
  CliLifecycleError,
  ensureManagedCli,
  executeResolvedCli,
  getCliAsset,
  managedCliPath,
  normalizeCustomPath,
  releaseUrl,
  resolveCli,
} from "./cli";
import { presentThemectlError } from "./errors";

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "themectl-extension-test-"));
}

function assetFor(contents: Buffer, filename = "themectl-test.tar.gz"): CliAsset {
  return { filename, sha256: createHash("sha256").update(contents).digest("hex") };
}

function response(contents: Buffer, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Failure",
    async arrayBuffer() {
      return Uint8Array.from(contents).buffer;
    },
  };
}

async function assertMissing(filePath: string): Promise<void> {
  await assert.rejects(access(filePath));
}

test("release metadata covers declared platforms with SHA-256 pins", () => {
  assert.deepEqual(Object.keys(CLI_ASSETS).sort(), ["darwin-arm64", "darwin-x64", "win32-arm64", "win32-x64"]);
  for (const asset of Object.values(CLI_ASSETS)) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.match(asset.filename, /^themectl_0\.10\.1_/);
    assert.equal(
      releaseUrl(asset),
      `https://github.com/Nico-Mayer/themectl/releases/download/v${CLI_VERSION}/${asset.filename}`,
    );
  }
  assert.equal(getCliAsset("darwin", "x64").filename, "themectl_0.10.1_darwin_amd64.tar.gz");
  assert.throws(
    () => getCliAsset("linux", "x64"),
    (error: unknown) => {
      return error instanceof CliLifecycleError && error.stage === "unsupported-platform";
    },
  );
});

test("custom paths normalize across supported platforms", () => {
  assert.equal(normalizeCustomPath("  ~/bin/themectl  ", "darwin", "/Users/test"), "/Users/test/bin/themectl");
  assert.equal(normalizeCustomPath('"C:\\Tools\\themectl"', "win32", "C:\\Users\\test"), "C:\\Tools\\themectl.exe");
  assert.equal(normalizeCustomPath("   ", "darwin", "/Users/test"), "");
});

test("custom path bypasses managed installation", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const customPath = path.join(root, "custom-themectl");
  await writeFile(customPath, "binary");
  await chmod(customPath, 0o755);
  let managedCalls = 0;

  const resolved = await resolveCli({
    customPath,
    supportPath: root,
    ensureManaged: async () => {
      managedCalls += 1;
      return "managed";
    },
  });

  assert.equal(resolved, customPath);
  assert.equal(managedCalls, 0);
});

test("empty custom path selects managed installation and missing override fails", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(
    await resolveCli({ customPath: "  ", supportPath: root, ensureManaged: async () => "managed" }),
    "managed",
  );
  await assert.rejects(resolveCli({ customPath: path.join(root, "missing"), supportPath: root }), (error: unknown) => {
    return error instanceof CliLifecycleError && error.stage === "custom-path";
  });

  const directory = path.join(root, "directory");
  await mkdir(directory);
  await assert.rejects(resolveCli({ customPath: directory, supportPath: root }), (error: unknown) => {
    return error instanceof CliLifecycleError && error.stage === "custom-path";
  });

  const nonExecutable = path.join(root, "non-executable");
  await writeFile(nonExecutable, "not executable", { mode: 0o644 });
  await assert.rejects(resolveCli({ customPath: nonExecutable, supportPath: root }), (error: unknown) => {
    return error instanceof CliLifecycleError && error.stage === "custom-path";
  });
});

test("Windows environment supplies config directories without replacing existing values", () => {
  assert.deepEqual(buildCliEnv("darwin", { HOME: "/Users/test" }, "/Users/test"), { HOME: "/Users/test" });
  assert.deepEqual(buildCliEnv("win32", { APPDATA: "custom", PATH: "bin" }, "C:\\Users\\test"), {
    APPDATA: "custom",
    LOCALAPPDATA: path.join("C:\\Users\\test", "AppData", "Local"),
    PATH: "bin",
  });
});

test("managed paths are version-addressed and platform-specific", () => {
  assert.equal(managedCliPath("/support", "1.2.3", "darwin"), path.join("/support", "cli", "1.2.3", "themectl"));
  assert.equal(
    managedCliPath("C:\\support", "2.0.0", "win32"),
    path.join("C:\\support", "cli", "2.0.0", "themectl.exe"),
  );
  assert.notEqual(managedCliPath("/support", "1.0.0"), managedCliPath("/support", "2.0.0"));
});

test("archive extraction commands avoid a shell", () => {
  assert.deepEqual(archiveCommand("/tmp/cli.tar.gz", "/tmp/out", "darwin"), {
    command: "/usr/bin/tar",
    args: ["-xf", "/tmp/cli.tar.gz", "-C", "/tmp/out"],
  });
  assert.deepEqual(archiveCommand("C:\\cli.zip", "C:\\out", "win32"), {
    command: "tar.exe",
    args: ["-xf", "C:\\cli.zip", "-C", "C:\\out"],
  });
});

test("successful install verifies, activates, reports progress, and cleans temporary files", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = Buffer.from("verified archive");
  const staleExecutable = managedCliPath(root, "old-version", "darwin");
  await mkdir(path.dirname(staleExecutable), { recursive: true });
  await writeFile(staleExecutable, "old");
  const stages: string[] = [];
  const executable = await ensureManagedCli({
    supportPath: root,
    platform: "darwin",
    arch: "arm64",
    version: "test-success",
    asset: assetFor(archive),
    fetchFn: async () => response(archive),
    extractFn: async (_archivePath, destination) => writeFile(path.join(destination, "themectl"), "executable"),
    onProgress: ({ stage }) => {
      stages.push(stage);
    },
  });

  assert.equal(await readFile(executable, "utf8"), "executable");
  assert.deepEqual(stages, ["download", "integrity", "extract", "activation"]);
  assert.deepEqual(await readdir(path.join(root, "cli", ".tmp")), []);
  assert.equal(await readFile(staleExecutable, "utf8"), "old");
});

test("new installs reap abandoned temp directories but preserve recent work", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const tempRoot = path.join(root, "cli", ".tmp");
  const abandoned = path.join(tempRoot, "abandoned");
  const recent = path.join(tempRoot, "recent");
  await mkdir(abandoned, { recursive: true });
  await mkdir(recent, { recursive: true });
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await utimes(abandoned, old, old);
  const archive = Buffer.from("gc archive");

  await ensureManagedCli({
    supportPath: root,
    platform: "darwin",
    version: "temp-gc",
    asset: assetFor(archive),
    fetchFn: async () => response(archive),
    extractFn: async (_archivePath, destination) => writeFile(path.join(destination, "themectl"), "executable"),
  });

  await assertMissing(abandoned);
  await access(recent);
});

test("matching installed version is reused without network access", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = managedCliPath(root, "already-installed", "darwin");
  await mkdir(path.dirname(executable), { recursive: true });
  await writeFile(executable, "existing");

  const resolved = await ensureManagedCli({
    supportPath: root,
    platform: "darwin",
    version: "already-installed",
    asset: assetFor(Buffer.from("unused")),
    fetchFn: async () => {
      throw new Error("network must not be used");
    },
  });
  assert.equal(resolved, executable);
});

test("download failures are staged and leave no executable", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = Buffer.from("archive");
  const common = {
    supportPath: root,
    platform: "darwin" as const,
    asset: assetFor(archive),
  };

  await assert.rejects(
    ensureManagedCli({ ...common, version: "http-failure", fetchFn: async () => response(archive, false, 503) }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "download",
  );
  await assert.rejects(
    ensureManagedCli({
      ...common,
      version: "network-failure",
      fetchFn: async () => {
        throw new Error("offline");
      },
    }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "download",
  );
  await assert.rejects(
    ensureManagedCli({
      ...common,
      version: "body-failure",
      fetchFn: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        async arrayBuffer() {
          throw new Error("stream interrupted");
        },
      }),
    }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "download",
  );
  await assertMissing(managedCliPath(root, "http-failure", "darwin"));
  await assertMissing(managedCliPath(root, "network-failure", "darwin"));
  await assertMissing(managedCliPath(root, "body-failure", "darwin"));
  assert.deepEqual(await readdir(path.join(root, "cli", ".tmp")), []);
});

test("checksum mismatch fails closed before extraction", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  let extracted = false;
  const version = "bad-checksum";

  await assert.rejects(
    ensureManagedCli({
      supportPath: root,
      platform: "darwin",
      version,
      asset: { filename: "bad.tar.gz", sha256: "0".repeat(64) },
      fetchFn: async () => response(Buffer.from("tampered")),
      extractFn: async () => {
        extracted = true;
      },
    }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "integrity",
  );
  assert.equal(extracted, false);
  await assertMissing(managedCliPath(root, version, "darwin"));
});

test("extraction failures and missing executables fail closed", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = Buffer.from("archive");
  const common = {
    supportPath: root,
    platform: "darwin" as const,
    asset: assetFor(archive),
    fetchFn: async () => response(archive),
  };

  await assert.rejects(
    ensureManagedCli({
      ...common,
      version: "extract-failure",
      extractFn: async () => {
        throw new Error("tar failed");
      },
    }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "extract",
  );
  await assert.rejects(
    ensureManagedCli({ ...common, version: "missing-binary", extractFn: async () => undefined }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "extract",
  );
  await assert.rejects(
    ensureManagedCli({
      ...common,
      version: "extract-permission",
      extractFn: async () => {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      },
    }),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "permission",
  );
});

test("Windows install expects themectl.exe", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = Buffer.from("windows archive");
  const executable = await ensureManagedCli({
    supportPath: root,
    platform: "win32",
    arch: "x64",
    version: "windows-test",
    asset: assetFor(archive, "themectl.zip"),
    fetchFn: async () => response(archive),
    extractFn: async (_archivePath, destination, platform) => {
      assert.equal(platform, "win32");
      await writeFile(path.join(destination, "themectl.exe"), "windows executable");
    },
  });
  assert.equal(path.basename(executable), "themectl.exe");
});

test("parallel callers share installation and atomic loser accepts complete winner", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = Buffer.from("parallel archive");
  let extracts = 0;
  const options = {
    supportPath: root,
    platform: "darwin" as const,
    version: "parallel",
    asset: assetFor(archive),
    fetchFn: async () => response(archive),
    extractFn: async (_archivePath: string, destination: string) => {
      extracts += 1;
      await writeFile(path.join(destination, "themectl"), "winner");
    },
  };

  const [first, second] = await Promise.all([ensureManagedCli(options), ensureManagedCli(options)]);
  assert.equal(first, second);
  assert.equal(extracts, 1);
});

test("atomic activation accepts a complete winner from a competing installer", async (t) => {
  const root = await temporaryDirectory();
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = Buffer.from("race archive");
  const version = "race-winner";
  const winnerPath = managedCliPath(root, version, "darwin");

  const resolved = await ensureManagedCli({
    supportPath: root,
    platform: "darwin",
    version,
    asset: assetFor(archive),
    fetchFn: async () => response(archive),
    extractFn: async (_archivePath, destination) => {
      await writeFile(path.join(destination, "themectl"), "loser");
      await mkdir(path.dirname(winnerPath), { recursive: true });
      await writeFile(winnerPath, "winner");
    },
  });

  assert.equal(resolved, winnerPath);
  assert.equal(await readFile(resolved, "utf8"), "winner");
});

test("resolved execution waits for resolver and forwards executable and arguments", async () => {
  const calls: unknown[][] = [];
  const result = await executeResolvedCli(
    ["set", "random"],
    async () => "/managed/themectl",
    async (executable, args) => {
      calls.push([executable, args]);
      return "done";
    },
  );
  assert.equal(result, "done");
  assert.deepEqual(calls, [["/managed/themectl", ["set", "random"]]]);
  await assert.rejects(
    executeResolvedCli(
      [],
      async () => Promise.reject(new CliLifecycleError("download", "offline")),
      async () => "no",
    ),
    (error: unknown) => error instanceof CliLifecycleError && error.stage === "download",
  );
});

test("lifecycle failures map to actionable, stage-specific messages", () => {
  const stages = [
    "unsupported-platform",
    "custom-path",
    "download",
    "integrity",
    "extract",
    "permission",
    "activation",
  ] as const;
  for (const stage of stages) {
    const presentation = presentThemectlError(new CliLifecycleError(stage, `${stage} detail`));
    assert.notEqual(presentation.title, "Themectl command failed");
    assert.equal(presentation.openPreferences, stage === "custom-path");
    assert.doesNotMatch(presentation.message, /\.tmp/);
  }
  assert.equal(presentThemectlError(new Error("exit 1")).title, "Themectl command failed");
});
