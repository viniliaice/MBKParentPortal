# Update Log

## 2026-07-24
* **Creation**: Initial OKF bundle produced from source code — all concepts.

## 2026-09-25
* **Parent-app redesign**: navigation is now Home / Marks / Messages / More (Learning hidden from the bar); Home leads with the selected child and their academic summary plus Monthly/Midterm/Final cards; Messages gained an Announcements segment; More carries children, appearance and the school-records menu — see [Routing](/app/routing.md).
* **Theme**: added light/dark/system appearance with a persisted preference, one `useColors()` hook and a suite that fails on hard-coded colours — see [Theme](/app/theme.md); [Platform UI](/app/platform-ui.md) is no longer dark-only.
* **Marks**: added [Marks & reports](/academics/marks.md) and `lib/reportSelectors.ts` (selection, labelling, pending reports) over the unchanged 40/60 calculations in [App Context](/state/app.md).
* **State**: `AppContext` gained `refresh`/`error`, the remembered child, unread communications and pending reports; the AsyncStorage key table now lists five keys.
* **Notifications**: a tapped announcement opens the announcements list — see [Notifications](/notifications.md).

