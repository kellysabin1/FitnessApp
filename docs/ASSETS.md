# Assets & licences (REP-7)

Every image, texture, font and icon set that ships in rep., where it came from, and the licence it's used under.
**Rule:** nothing from Pinterest, Google Images or any other photo site ships unless we hold a licence for it
(or it's replaced). Add a row here in the same pull request as any new asset.

_Last audited: 2026-11-24 — every file in `assets/` and `public/` is accounted for; no third-party imagery ships._

## Images and textures

| File                                                                              | What it is                         | Source                                                                                                                               | Licence                                                                                                |
| --------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `assets/textures/croc.jpg`                                                        | Croc-leather card texture          | Generated procedurally for rep. in code (noise + lighting, numpy/Pillow). Inspired by the owner's mood board; **not** copied from it | Original work, owned by the project                                                                    |
| `assets/textures/tortoise.jpg`                                                    | Tortoiseshell card texture         | Generated procedurally for rep.                                                                                                      | Original work, owned by the project                                                                    |
| `assets/textures/satin.jpg`                                                       | Burgundy satin card texture        | Generated procedurally for rep.                                                                                                      | Original work, owned by the project                                                                    |
| `assets/images/icon.png`                                                          | App icon (italic _r_ + line heart) | Drawn for rep. (Cormorant Garamond glyph + hand-built heart path)                                                                    | Original work; uses Cormorant Garamond under OFL 1.1 (glyph outlines may be embedded in logos/artwork) |
| `assets/images/splash-icon.png`                                                   | Launch screen mark                 | Same artwork as the icon                                                                                                             | as above                                                                                               |
| `assets/images/android-icon-foreground.png`, `-background.png`, `-monochrome.png` | Android adaptive icon layers       | Same artwork as the icon                                                                                                             | as above                                                                                               |
| `assets/images/favicon.png`                                                       | Browser tab icon                   | Same artwork as the icon                                                                                                             | as above                                                                                               |
| `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`       | Home-screen / PWA icons            | Same artwork as the icon                                                                                                             | as above                                                                                               |

## Fonts

| Font                               | How it's included                           | Licence                                      |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------- |
| Cormorant Garamond (display serif) | npm `@expo-google-fonts/cormorant-garamond` | SIL Open Font License 1.1 (package code MIT) |
| DM Sans (body)                     | npm `@expo-google-fonts/dm-sans`            | SIL Open Font License 1.1 (package code MIT) |
| Ionicons (UI icons)                | npm `@expo/vector-icons`                    | MIT                                          |

The OFL allows bundling the fonts in the app and using them in the logo; it doesn't allow selling the font
files on their own. (`assets/fonts/SpaceMono-Regular.ttf` from the Expo template was unused and has been removed.)

## Other files in `public/`

| File                                   | Licence                      |
| -------------------------------------- | ---------------------------- |
| `index.html`, `manifest.json`, `sw.js` | Project code (see `LICENSE`) |

## Before the App Store

- Re-run this audit (`git ls-files assets public`) and confirm every file has a row.
- App Store screenshots and marketing images need the same treatment.
