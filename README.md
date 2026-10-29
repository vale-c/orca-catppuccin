# Catppuccin for Orca

[Catppuccin](https://catppuccin.com/) app, editor and terminal themes for
[Orca](https://github.com/stablyai/orca), in all four flavors: Latte, Frappé, Macchiato and Mocha.
The plugin lives in [`plugins/catppuccin`](plugins/catppuccin), and its
[README](plugins/catppuccin/README.md) lists what it adds and how it differs from upstream.

## Install

Add this repository as a catalog source:

1. In Orca, open Settings → Plugins and turn on plugins.
2. Open ⋯ → **Catalog sources…**.
3. Add `https://github.com/vale-c/orca-catppuccin.git` with ref `main`.
4. Install **Catppuccin for Orca** from the catalog.

To try a local copy instead, add the `plugins/catppuccin` folder under **Development folders…**
in Settings → Plugins. Orca reloads the themes when the files change.

## Build and verify

The theme files in `plugins/catppuccin/themes` and `plugins/catppuccin/terminal` are generated.
Do not edit them by hand. Change `scripts/build.mjs` and rebuild instead.

```sh
node scripts/build.mjs           # regenerate the theme files from scripts/catppuccin-palette.json
node scripts/build.mjs --check   # exit 1 if a committed file is out of date
```

The build fails when an app token pair is under Orca's contrast floor. It prints every syntax
color it adjusted to reach 3:1 on the editor background.

To check the themes with Orca's own runtime code, point `ORCA_DIR` at an Orca checkout with its
dependencies installed:

```sh
ORCA_DIR=/path/to/orca node scripts/verify.mjs
cd /path/to/orca && node config/scripts/validate-plugin-files.mjs /path/to/orca-catppuccin/plugins/catppuccin
```

`verify.mjs` fails when Orca would drop a theme token or a syntax color, or reject a terminal theme.

## License

MIT. See [LICENSE](LICENSE). The Catppuccin palette is MIT licensed by Catppuccin, and its
notice is included in [plugins/catppuccin/LICENSE](plugins/catppuccin/LICENSE).
