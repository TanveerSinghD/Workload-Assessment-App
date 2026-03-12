WorkLoadAssApp
==============

WorkLoadAssApp is a local study planner built with Expo Router and React Native. It keeps tasks on the device, gives you a planner view, calendar view, focus timer, reminders, and a simple account flow without needing a backend.

## What is in the current build

- Home, Tasks, Planner, Calendar, and Settings tabs
- Add task and edit task flows
- Completed tasks screen
- Focus session screen with timer and task queue
- Local email sign up / sign in
- App lock with PIN
- Daily reminder settings
- Theme and accent colour settings
- Planner assistant and task actions
- Web fallbacks for local storage so the web build works without native-only storage APIs

## Main features

### Tasks
- Tasks are stored locally.
- Each task can have notes, due date, difficulty, priority, category, and completion state.
- You can add, edit, duplicate, complete, restore, and delete tasks.

### Planner
- The planner ranks open tasks and builds a simple suggested order.
- There is a built-in planner chat helper for rescheduling, task help, and quick actions.

### Calendar
- The calendar screen shows due dates with difficulty markers.
- You can filter by subject, difficulty, and completion state.

### Focus
- The focus screen gives you a timer, a suggested queue, and saved session progress.

### Settings
- Reminder controls
- Theme and accent controls
- Navigation quick actions
- Demo task tools
- Data clearing tools

## Tech stack

- Expo 54
- React Native 0.81
- React 19
- Expo Router 6
- `expo-sqlite`
- `expo-secure-store`
- `expo-notifications`
- `react-native-calendars`
- `react-native-gifted-charts`

## Project layout

- `app/` - routes and screens
- `app/(tabs)/` - main tab screens
- `app/add-assignment.tsx` - create task screen
- `app/edit-task.tsx` - edit task screen
- `app/focus-session.tsx` - focus timer screen
- `app/theme-settings.tsx` - theme settings
- `app/nav-quick-actions.tsx` - quick action settings
- `assistant_engine/` - planner assistant matching and responses
- `assistant_actions/` - assistant-triggered actions
- `plannerAssistant/` - planner chat helpers
- `lib/database.ts` - native SQLite task and account storage
- `lib/database.web.ts` - web storage fallback for tasks and accounts
- `lib/nav-quick-actions-store.ts` - native quick action storage
- `lib/nav-quick-actions-store.web.ts` - web quick action storage
- `lib/secure-store.ts` - storage wrapper
- `lib/secure-store.web.ts` - web storage fallback
- `lib/notifications.ts` - reminder logic
- `lib/app-lock-storage.ts` - PIN and lock state logic
- `metro.config.js` - Metro config for the web build
- `ios/` - generated native iOS project

## Running the app

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

Run a target:

```bash
npm run ios
npm run android
npm run web
```

## Scripts

- `npm start`
- `npm run ios`
- `npm run android`
- `npm run web`
- `npm run lint`
- `npm run test:assistant`
- `npm run test:planner-assistant`
- `npm run test:planner-context`
- `npm run reset-project`

## Storage notes

- Native uses SQLite for tasks and account/session data.
- Web uses local browser storage fallbacks for the same app flows.
- Reminder settings, focus session data, app lock state, and theme preferences are stored locally.
- There is no remote backend or cloud sync in this repo.

## Assets

- Screenshots are in `screenshots/`
- App icons and splash assets are in `assets/images/`

## Troubleshooting

- If Metro gets stuck, run `npx expo start --clear`
- If the web build looks stale, restart with `npx expo start --web --clear`
- If reminders do not fire, re-check notification permissions
- If local data gets into a bad state after a schema change, reinstall the app or clear local data on the simulator/device
