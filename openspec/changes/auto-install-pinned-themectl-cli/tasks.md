## 1. Preference and Test Foundation

- [x] 1.1 Make `themectlPath` optional in extension preferences, update generated/manual preference typing as needed, and verify `npm run build` accepts both missing and populated values.
- [x] 1.2 Add a focused unit-test setup for CLI lifecycle utilities and verify the test command runs a passing smoke test on the development platform.

## 2. Managed CLI Resolution

- [x] 2.1 Add pinned `themectl` version and macOS/Windows arm64/amd64 release metadata using reviewed GitHub release filenames and SHA-256 checksums; verify tests cover every platform declared in `package.json`, reject unknown combinations, and validate checksum format.
- [x] 2.2 Implement custom-path normalization plus async custom-or-managed executable resolution; verify tests prove non-empty overrides bypass all managed installation work while empty and whitespace-only values select managed mode.
- [x] 2.3 Implement version-addressed support-directory paths and existing-install detection; verify tests prove the pinned executable is reused offline and a changed pin resolves to a distinct installation target.

## 3. Verified Installation Lifecycle

- [x] 3.1 Implement pinned archive download into a unique temporary directory with stage-specific errors; verify tests cover successful responses, HTTP failures, network failures, and temporary-file cleanup.
- [x] 3.2 Implement SHA-256 verification before extraction; verify matching fixtures continue and mismatched fixtures are deleted without creating a managed executable.
- [x] 3.3 Implement shell-free archive extraction for `.tar.gz` and `.zip` release assets, expected-binary validation, and POSIX executable permissions; verify macOS and Windows argument/path construction plus missing-binary and extraction-failure cases.
- [x] 3.4 Implement atomic activation, parallel-installer convergence, safe older-version retention, and abandoned-temp cleanup; verify interrupted or losing installs cannot leave a partial pinned target, active version paths are not deleted, and a later invocation retries cleanly.

## 4. Command Integration and Error UX

- [x] 4.1 Refactor shared `themectl` execution to await executable resolution before every invocation while preserving Windows environment handling; verify no-view command tests cover managed, custom, install-failure, missing-custom-path, and CLI-execution outcomes.
- [x] 4.2 Replace direct synchronous `useExec` usage in theme and wallpaper views with async loaders that share the resolver; verify both views remain loading through installation and render parsed CLI output afterward.
- [x] 4.3 Add actionable user-facing messages for download, integrity, extraction, activation, unsupported-platform, custom-path, and execution failures, including preferences access for invalid overrides; verify each failure category maps to its intended title/action without leaking temporary paths unnecessarily.

## 5. Cross-Platform Validation and Documentation

- [x] 5.1 Run unit tests, `npm run lint`, and `npm run build`; fix failures and record successful outputs for implementation review.
- [ ] 5.2 Perform clean-support-directory first-use checks on macOS for install, reuse, and simulated pin upgrade, then validate Windows behavior through available CI or a Windows Raycast environment; confirm correct archive selection, executable naming, and command output.
- [x] 5.3 Update README/setup and changelog text to explain automatic pinned installation, optional unmanaged override, offline behavior, and maintainer pin/checksum update procedure; verify documentation matches shipped preference labels and lifecycle behavior.
