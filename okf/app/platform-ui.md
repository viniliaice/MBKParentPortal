---
type: Configuration
title: Platform UI
description: Platform-specific rendering branches for iOS, Android, and Web.
tags: [ui, platform]
timestamp: 2026-07-24T14:00:00Z
---

# Tab bar

| Platform | Background |
|----------|-----------|
| iOS | `BlurView` with `intensity={80}` and `tint="dark"` |
| Android | Plain `#0B1026` background |
| Web | Unstyled (no background view rendered) |

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

Dark-only (`userInterfaceStyle: "dark"` in `app.json`). The color palette in
`constants/colors.ts` has identical light and dark exports — always read from
there, never hardcode hex values.