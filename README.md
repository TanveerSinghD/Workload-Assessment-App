# WorkloadAssApp

An Expo Router task planner that keeps your assignments on-device in SQLite. Add tasks with due dates and difficulty, and manage them from a dashboard, planner, calendar, and filtered lists.

## Overview
- On-device storage (SQLite) for tasks; no cloud required.
- Smart planner ranks tasks by due date and effort, builds a short schedule, and highlights overdue items.
- Dashboard shows health stats, quick wins, overdue risk, and difficulty balance.
- Calendar uses multi-dot markers for difficulty and a 7-day agenda.
- Settings support clipboard import/export, seeding demo tasks, and clearing data.

## Screens
- **Home dashboard**: health stats, overdue and upcoming counts, difficulty mix, quick wins, recent/oldest items.
- **Planner**: prioritized list, suggested order, and a time-boxed schedule for today.
- **Tasks**: grouped by difficulty with quick actions, duplication, and completion toggle.
- **Calendar**: month view with difficulty dots and next-7-day agenda; filter by difficulty and completion.
- **Settings**: import/export via clipboard, add 10 dummy tasks, clear completed/all tasks, reset demo data.

## Tech stack
- Expo + React Native (Expo Router v6)
- SQLite via `expo-sqlite`
- UI: `react-native-gifted-charts`, `react-native-calendars`, `@expo/vector-icons`, `expo-blur`, `expo-linear-gradient`

## Project structure
- `app/_layout.tsx` – root stack and database init
- `app/(tabs)/_layout.tsx` – tab bar and routes
- `app/(tabs)/index/` – dashboard
- `app/(tabs)/planner/` – planner view
- `app/(tabs)/tasks/` – difficulty-grouped task list
- `app/(tabs)/calendar/` – calendar view
- `app/(tabs)/settings/` – utilities and data actions
- `lib/database.ts` – SQLite schema and CRUD helpers

## Getting started
1. Install dependencies: `npm install`
2. Run the app: `npx expo start`
   - iOS simulator: `npm run ios`
   - Android emulator: `npm run android`
   - Web: `npm run web`

## Useful scripts
- `npm start` – launch Expo
- `npm run ios` / `npm run android` / `npm run web` – platform targets
- `npm run reset-project` – reset to a blank app (keeps starter under `app-example`)
- `npm run lint` – run Expo lint rules

## Data and storage
- Tasks are stored locally in `tasks.db` (managed in `lib/database.ts` via `expo-sqlite`).
- To wipe data, use Settings → Clear All Tasks or delete `tasks.db` from the device/simulator.
- Import/export uses the clipboard as JSON; dummy data seeding is available in Settings.

## Troubleshooting
- Stuck Metro bundler? Stop the dev server and run `npx expo start --clear`.
- If native builds misbehave, reinstall node modules (`rm -rf node_modules && npm install`) and restart Expo.
