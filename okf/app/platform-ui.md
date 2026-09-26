---
type: Configuration
title: Platform UI
description: Platform-specific rendering branches for iOS, Android, and Web.
tags: [ui, platform]
timestamp: 2026-09-25T00:00:00Z
---

# Tab bar

| Platform | Background |
|----------|-----------|
| iOS | `BlurView` with `intensity={80}` and `tint` following the theme |
| Android | Solid `colors.tabBar` |
| Web | Solid `colors.tabBar` (84pt tall) |

# Icons

| Platform | Library |
|----------|---------|
| iOS | `expo-symbols` (SF Symbols) via `SymbolView` |
| Android / Web | `@expo/vector-icons` (Ionicons) |

Every icon needs both — the code branches on `Platform.OS === 'ios'`.

# Keyboard-avoiding scroll

Use `KeyboardAwareScrollViewCompat` (from `components/`), not the raw library
component. On web it renders a plain `ScrollView`; on native it uses
`react-native-keyboard-controller`'s `KeyboardAwareScrollView`.

# Theme

Light, dark or system, chosen in More → Appearance and remembered on the device; the
palettes and the rules live in [Theme](/app/theme.md). Always read colours from
`useColors()` — never hardcode hex values.