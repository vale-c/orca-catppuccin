# Catppuccin for Orca

Soothing pastel application themes in all four Catppuccin flavors (Latte, Frappé, Macchiato,
Mocha), with matching terminal colors.

Each flavor colors the app, the code editor and the terminal. Latte is a light theme. Frappé,
Macchiato and Mocha are dark themes.

Select **Catppuccin Latte** as the light theme and **Catppuccin Frappé**, **Catppuccin Macchiato**
or **Catppuccin Mocha** as the dark theme in Appearance settings. Select the matching terminal
theme in terminal settings.

## Attribution

An unofficial Orca port of [Catppuccin](https://catppuccin.com/), built from palette v1.8.0.
The app mapping and syntax scopes are maintained here and follow the
[Catppuccin style guide](https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md).

Orca drops a syntax color under 3:1 contrast with the editor background, so these Latte syntax
colors are darkened in OKLCH lightness only, keeping chroma and hue:

| Color | Upstream | Shipped |
| --- | --- | --- |
| Rosewater | `#dc8a78` | `#c47463` |
| Pink | `#ea76cb` | `#d260b5` |
| Peach | `#fe640b` | `#f05700` |
| Yellow | `#df8e1d` | `#c77700` |
| Green | `#40a02b` | `#3d9d28` |
| Sky | `#04a5e5` | `#0092d1` |

Latte also uses Subtext 1 instead of Subtext 0 for muted text, because Subtext 0 on Base is under
Orca's 4.5:1 floor for text. Frappé, Macchiato and Mocha use the upstream palette unchanged.
Terminal ANSI colors use the upstream palette unchanged in every flavor.

Upstream license notices are included in [LICENSE](LICENSE).
