## Why

Requiring every user to locate and configure a `themectl` executable adds avoidable setup friction and makes commands fail before the extension can provide value. The extension should supply a trusted, compatible CLI by default while preserving an escape hatch for users who manage their own binary.

## What Changes

- Make the `themectl` path preference optional and treat a non-empty value as an unmanaged user override.
- Automatically install an extension-pinned `themectl` release on first command use when no override is configured.
- Select the correct release asset for each Raycast-supported operating system and CPU architecture.
- Verify downloaded archives against pinned SHA-256 checksums before installation.
- Detect when the managed CLI does not match the extension's pinned version and replace it before command execution.
- Surface actionable install, verification, unsupported-platform, and execution failures without requiring users to configure a path.

## Capabilities

### New Capabilities
- `managed-themectl-cli`: Automatic, verified lifecycle management and resolution of a pinned `themectl` executable, with optional custom-path override behavior.

### Modified Capabilities

None.

## Impact

- Affects extension preferences in `package.json`, shared CLI resolution/execution utilities, and every command that invokes `themectl` directly or through `useExec`.
- Adds network access to GitHub release assets during first install and after pinned-version changes.
- Adds managed binary and metadata storage under Raycast's extension support directory.
- Requires platform/architecture asset metadata and SHA-256 values to be updated whenever the extension raises its pinned CLI version.
