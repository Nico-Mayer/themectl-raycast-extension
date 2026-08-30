# Themectl for Raycast

Switch themes and wallpapers with [`themectl`](https://github.com/Nico-Mayer/themectl) from Raycast on macOS and Windows.

## CLI setup

No manual CLI setup is required. On first command use, extension downloads its pinned `themectl` version from GitHub Releases, verifies archive SHA-256 checksum, and installs executable inside Raycast extension support directory.

Matching managed version is reused without network access. When extension update requires newer CLI version, next command downloads and activates that pinned version before running. If download or verification fails, command stops instead of falling back to an older managed version; retry command after connection or release issue is resolved.

### Custom executable

Set **Custom Themectl Executable** in extension preferences to use your own binary. Custom path is optional and unmanaged: extension never installs, updates, or version-checks configured executable. Clear preference to return to managed CLI.

## Commands

- **Set Theme** — choose installed theme
- **Pick Wallpaper** — choose wallpaper for current theme
- **Random Theme** — set random theme
- **Random Light Theme** — set random light theme
- **Random Dark Theme** — set random dark theme
- **Random Wallpaper** — set random wallpaper for current theme

## Updating pinned CLI

Maintainers update `CLI_VERSION` and every entry in `CLI_ASSETS` in `src/utils/cli.ts` together:

1. Choose tested stable release from [themectl releases](https://github.com/Nico-Mayer/themectl/releases).
2. Copy exact macOS/Windows arm64/amd64 asset filenames and SHA-256 values from release checksum manifest.
3. Run `npm test`, `npm run lint`, and `npm run build`.
4. Perform clean-support-directory install smoke test before publishing extension update.

Extension does not query GitHub's latest-release API at runtime. Version changes remain reviewed and deterministic.
