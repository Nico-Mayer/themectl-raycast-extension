## Context

All commands currently resolve a required `themectlPath` preference synchronously at module load. Two view commands pass that path directly to `useExec`; no-view commands use a shared `execFile` wrapper. Managed installation requires asynchronous download and preparation before either command style can execute.

Raycast currently declares macOS and Windows support. `themectl` GitHub releases publish versioned `.tar.gz` assets for Darwin and `.zip` assets for Windows, for both amd64 and arm64, plus a checksum manifest. Raycast provides a per-extension support directory suitable for managed files.

## Goals / Non-Goals

**Goals:**
- Keep custom path behavior as an optional, unmanaged override.
- Give all command types one asynchronous executable-resolution boundary.
- Make extension-to-CLI compatibility deterministic through code-reviewed version and checksum pins.
- Install archives safely on macOS and Windows without invoking a shell.
- Make concurrent or interrupted first-use attempts unable to expose a partial executable.

**Non-Goals:**
- Discover or prefer executables from `PATH` when the override is empty.
- Auto-update user-supplied executables.
- Follow GitHub's latest release dynamically at runtime.
- Run a background updater or downgrade automatically outside command startup.
- Manage `themectl` configuration, themes, or authentication.

## Decisions

### Pin release metadata in extension source

Define a required version and platform table keyed by Node's normalized platform/architecture values. Each entry contains archive filename, archive type, and SHA-256 checksum. Build the download URL from the pinned tag and filename.

This makes every extension build reproducible and prevents a newly published CLI release from changing behavior without extension review. "Newest required CLI" means the version pinned by the installed extension; maintainers raise the pin and checksums in an extension update.

Alternative: query GitHub's latest-release API on every run. Rejected because it conflicts with pinning, introduces API availability/rate-limit dependency, and can deliver an untested CLI.

Alternative: download the release checksum manifest at install time. Rejected as sole verification because archive and checksum would share the same mutable remote trust event. Checked-in checksums provide a reviewable trust anchor.

### Resolve custom or managed CLI through one async API

Replace the exported module-level path with an async resolver. It first reads and normalizes the optional preference. Non-empty values return immediately as unmanaged overrides. Empty values call the managed installer.

`runThemectl` awaits this resolver. View commands move from direct `useExec` calls to an async data loader (for example, `usePromise` around shared execution) so install and query form one loading lifecycle. This avoids rendering data hooks with a path that may not exist yet.

Alternative: start installation during module import and retain `useExec`. Rejected because module initialization cannot reliably represent progress or errors and would create hidden side effects before command execution.

### Use version-addressed managed storage

Store binaries under `environment.supportPath/cli/<version>/themectl` (or `themectl.exe`). Presence of executable at pinned-version path is installed-state marker; no separate mutable version metadata is needed. Pin changes naturally resolve to a new path. Retain older version directories: deleting them during another extension process can race an executable already resolved for use. Abandoned temporary install directories older than 24 hours are removed best-effort on later installs.

Alternative: overwrite one binary plus version metadata. Rejected because metadata and executable can diverge after interruption and rollback is harder to reason about.

### Verify archive, extract in isolation, then activate

Download into a uniquely named temporary directory under support path. Stream or buffer while computing SHA-256, compare against checked-in value, then extract into that isolated directory. Invoke platform archive tooling with `execFile` argument arrays—`/usr/bin/tar` on macOS and system `tar.exe` on Windows—without shell interpolation. Locate expected `themectl` executable, set executable mode on POSIX, then atomically rename the prepared version directory into place. Clean temporary files in `finally`.

Archive contents are activated only after checksum verification. Version-addressed destination plus atomic rename makes parallel installers converge safely: winner activates; loser detects existing complete destination and discards its temporary copy.

Alternative: add archive-extraction npm dependencies. Rejected initially to minimize extension dependency and supply-chain surface; revisit if Raycast-supported Windows environments cannot guarantee `tar.exe`.

Alternative: extract directly into final directory. Rejected because interrupted extraction could look installed.

### Fail closed on required-version install errors

If pinned-version installation fails, do not execute an older managed version. Preserve no partial target and let next invocation retry. Keep existing custom-path error behavior distinct and link it to preferences; never silently switch a broken explicit override to managed mode.

This favors compatibility and integrity over availability. Error toasts/messages identify stage (download, verify, extract, activate, execute) and retain technical cause for diagnosis.

## Risks / Trade-offs

- [System archive tool differs across Windows installations] → Validate against Raycast's supported Windows baseline; replace with a narrowly scoped extraction library if `tar.exe` is not guaranteed.
- [Release asset naming or checksums change] → Treat platform table update as required release-maintenance work and cover URL mapping with tests.
- [GitHub outage blocks first use or required upgrade] → Reuse matching installed version offline; fail clearly and retry later when new pin is not installed.
- [Parallel command processes install simultaneously] → Use unique temporary paths, checksum verification, version-addressed destinations, and atomic activation with loser cleanup.
- [Retained managed versions consume disk] → Accept small versioned binaries to avoid cross-process deletion races; revisit cleanup only with a portable lease protocol.
- [Custom path can point to incompatible CLI] → Keep override explicitly unmanaged and report its execution errors; compatibility remains user's responsibility.

## Migration Plan

1. Ship extension with path preference optional and an initial pinned version/checksum table covering declared macOS and Windows architectures.
2. Existing users with a non-empty preference continue using their custom executable unchanged.
3. Existing users who clear the preference and new users receive managed CLI on next command use.
4. Future CLI requirement changes update version, asset names, and checksums together; next command installs that version before execution.
5. Rollback by releasing prior extension pin. Its retained version-addressed binary is reused without another download.
