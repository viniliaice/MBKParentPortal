---
type: Concept
title: Theme
description: Light, dark and system appearance — one palette pair, one hook, one persisted preference.
tags: [ui, theme, appearance]
timestamp: 2026-09-25T00:00:00Z
---

# One theme system

| Piece | Role |
|-------|------|
| `constants/colors.ts` | `AppColors` interface + the `light` and `dark` palettes; also `accessibleAccent()` and `withAlpha()` |
| `context/ThemeContext.tsx` | `preference` (`light` / `dark` / `system`), the resolved `scheme`, and `setPreference` |
| `hooks/useColors.ts` | `useColors()` → `{ ...palette, radius }`, the only way a screen reads a colour |
| `components/AuroraBackground.tsx` | The gradient wash behind every screen, taken from the palette |
| `components/AppearanceToggle.tsx` | The Light / Dark / System control, shown in **More → Appearance** |

The two palettes declare the same keys, so a missing token is a type error rather than a
dark-mode-only crash. Screens build their styles inside a memoised factory —
`const styles = useMemo(() => makeStyles(c), [c])` — instead of a module-level
`StyleSheet.create`, which is what lets one screen render correctly in both modes.

# Preference and persistence

`ThemeProvider` sits above the error boundary in `app/_layout.tsx`, so the crash screen is
themed too. The preference is stored on the device under `@mbk_theme`; `system` (the
default) follows the OS via `useColorScheme()`. `app.json` sets
`userInterfaceStyle: "automatic"` so the OS reports the real scheme.

# Wide screens

The app is phone-first, so on a tablet or a desktop browser `app/_layout.tsx` caps the
content column at 720pt and centres it. Without it, phone-sized cards stretch to the full
width and line lengths become hard to read.

# Rules

- Never hard-code a colour in a screen or component: `tests/app/theme.test.mjs` fails the
  suite if `#rrggbb` or `rgba(` appears under `app/` or `components/`.
- Accent colours that arrive with the data (curriculum subject/topic colours, per-child
  avatar colours) are the exception; pass them through `accessibleAccent(hex, isDark)`
  before using them as text, icons or bars, and `withAlpha(hex, a)` when a translucent
  tint of a status colour is needed.
- There is exactly one theme system. Do not add a second palette, context or toggle.
