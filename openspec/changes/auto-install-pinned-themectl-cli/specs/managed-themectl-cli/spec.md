## Purpose

Provide every supported Raycast user with a trusted, compatible `themectl` executable by default while retaining an explicit custom-binary override.

## ADDED Requirements

### Requirement: Optional custom executable override
The extension SHALL make the custom `themectl` path preference optional. When the preference contains a non-empty value, the extension SHALL use that executable for all CLI operations and SHALL NOT install, replace, or version-check it.

#### Scenario: User configures a custom executable
- **WHEN** a command starts and the custom path preference contains a value
- **THEN** the command invokes the executable at the normalized custom path without downloading a managed CLI

#### Scenario: User leaves custom path empty
- **WHEN** a command starts and the custom path preference is absent, empty, or whitespace-only
- **THEN** the extension resolves an extension-managed CLI

### Requirement: Pinned managed CLI installation
The extension SHALL declare one required `themectl` version as part of each extension build. When no custom path is configured and that managed version is not installed, the extension SHALL download and install that exact version before executing the requested command.

#### Scenario: First use installs CLI
- **WHEN** a command starts without a custom path and the required managed CLI is absent
- **THEN** the extension installs the pinned version and executes the command with the installed executable

#### Scenario: Required version is already installed
- **WHEN** a command starts without a custom path and the pinned managed version is already installed
- **THEN** the extension reuses it without a network request

#### Scenario: Extension requires a newer version
- **WHEN** an extension update changes the pinned version and only an older managed version is installed
- **THEN** the extension installs the newly pinned version before executing the command and does not fall back to the older version if installation fails

### Requirement: Supported platform asset selection
The extension SHALL map the current operating system and CPU architecture to a pinned release asset. It SHALL support every operating-system and architecture combination declared by the extension and published for the pinned `themectl` release.

#### Scenario: Supported platform starts installation
- **WHEN** installation runs on a declared platform and architecture with pinned asset metadata
- **THEN** the extension downloads the matching archive and installs the contained executable using the platform-appropriate filename and permissions

#### Scenario: Platform has no pinned asset
- **WHEN** installation runs on an operating-system or architecture combination without pinned asset metadata
- **THEN** the extension stops before downloading or executing code and reports the unsupported combination

### Requirement: Download integrity and safe activation
The extension MUST verify a downloaded release archive against the SHA-256 checksum pinned for its platform before making the executable available. Installation SHALL use temporary storage and SHALL expose only a fully downloaded, verified, and extracted executable as the managed CLI.

#### Scenario: Archive passes verification
- **WHEN** the downloaded archive checksum equals the pinned checksum
- **THEN** the extension extracts and activates the managed executable

#### Scenario: Archive fails verification
- **WHEN** the downloaded archive checksum differs from the pinned checksum
- **THEN** the extension deletes temporary artifacts, leaves no new executable available, reports an integrity error, and does not run the requested command

#### Scenario: Download or extraction is interrupted
- **WHEN** installation fails before activation completes
- **THEN** the extension cleans up temporary artifacts and does not treat the partial installation as usable

### Requirement: Consistent command integration
Every extension command that invokes `themectl` SHALL resolve the executable through the same asynchronous custom-or-managed CLI flow before execution.

#### Scenario: View command needs CLI output
- **WHEN** a view command loads data without a custom executable configured
- **THEN** its loading state remains active while the managed CLI is resolved and then displays output from that executable

#### Scenario: No-view command runs
- **WHEN** a no-view command starts without a custom executable configured
- **THEN** it resolves or installs the managed CLI before invoking its requested operation

### Requirement: Actionable lifecycle failures
The extension SHALL report download, checksum, extraction, permission, unsupported-platform, custom-path, and CLI execution failures in user-facing messages that identify the failed stage. A failed managed installation SHALL be retried on a later command invocation.

#### Scenario: Network is unavailable during required install
- **WHEN** the extension cannot download the pinned asset
- **THEN** it reports an installation download failure and does not execute the requested CLI operation

#### Scenario: Configured custom executable is missing
- **WHEN** a custom path is configured but no executable exists at that path
- **THEN** the extension reports the invalid override and offers access to extension preferences rather than silently installing a managed CLI

#### Scenario: User retries after installation failure
- **WHEN** a later command starts after an earlier managed installation failed
- **THEN** the extension attempts installation again because no complete managed executable was activated
