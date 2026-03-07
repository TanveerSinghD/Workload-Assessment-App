import { Href } from "expo-router";

export type NavItemId = "home" | "tasks" | "planner" | "calendar" | "settings";

export type QuickActionId =
  | "none"
  | "goHome"
  | "new_task"
  | "due_today"
  | "overdue"
  | "completed"
  | "openPlanner"
  | "openCalendar"
  | "openSettings"
  | "openCompleted";

export type NavItem = {
  id: NavItemId;
  label: string;
  icon: string;
  routeName: string; // expo-router route inside /(tabs)
  routePath: string; // "/index/index"
  defaultQuickAction: QuickActionId;
  quickActions: QuickActionId[];
};

// All quick actions are routed here so the tab bar can trigger them without duplicating navigation code.
export const quickActionRegistry: Record<
  QuickActionId,
  { label: string; run: (router: { navigate: (href: Href) => void; push: (href: Href) => void }) => void }
> = {
  none: {
    label: "Nothing",
    run: () => {
      // Explicitly do nothing for tabs where quick actions are disabled.
    },
  },
  goHome: {
    label: "Go to Home",
    run: (router) => router.navigate("/(tabs)/index/index" as any),
  },
  new_task: {
    label: "New task",
    run: (router) => router.push("/add-assignment"),
  },
  due_today: {
    label: "Tasks due today",
    run: (router) => router.navigate({ pathname: "/(tabs)/tasks/tasks", params: { filter: "today" } }),
  },
  overdue: {
    label: "Overdue tasks",
    run: (router) => router.navigate({ pathname: "/(tabs)/tasks/tasks", params: { filter: "overdue" } }),
  },
  completed: {
    label: "Completed tasks",
    run: (router) => router.push("/completed-tasks"),
  },
  openPlanner: {
    label: "Open Planner",
    run: (router) => router.navigate("/(tabs)/planner/planner"),
  },
  openCalendar: {
    label: "Open Calendar",
    run: (router) => router.navigate("/(tabs)/calendar/calendar"),
  },
  openSettings: {
    label: "Open Settings",
    run: (router) => router.navigate("/(tabs)/settings/settings"),
  },
  openCompleted: {
    label: "Completed tasks",
    run: (router) => router.push("/completed-tasks"),
  },
};

export const navItems: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: "house.fill",
    routeName: "index/index",
    routePath: "/index/index",
    defaultQuickAction: "none",
    quickActions: ["none"],
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: "checklist",
    routeName: "tasks/tasks",
    routePath: "/tasks/tasks",
    defaultQuickAction: "new_task",
    quickActions: ["new_task", "due_today", "overdue", "completed"],
  },
  {
    id: "planner",
    label: "Planner",
    icon: "pencil.and.outline",
    routeName: "planner/planner",
    routePath: "/planner/planner",
    defaultQuickAction: "none",
    quickActions: ["none"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "calendar",
    routeName: "calendar/calendar",
    routePath: "/calendar/calendar",
    defaultQuickAction: "none",
    quickActions: ["none"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "gearshape.fill",
    routeName: "settings/settings",
    routePath: "/settings/settings",
    defaultQuickAction: "none",
    quickActions: ["none"],
  },
];

export const NAV_ITEM_IDS = navItems.map((n) => n.id);
export const QUICK_ACTION_IDS = Object.keys(quickActionRegistry) as QuickActionId[];

export const DEFAULT_NAV_QUICK_ACTIONS = navItems.reduce<Record<NavItemId, QuickActionId>>((acc, item) => {
  acc[item.id] = item.defaultQuickAction;
  return acc;
}, {} as Record<NavItemId, QuickActionId>);

export function runQuickAction(actionId: QuickActionId, router: { navigate: (href: Href) => void; push: (href: Href) => void }) {
  const action = quickActionRegistry[actionId];
  if (action) {
    action.run(router);
  }
}

export function executeNavQuickAction(navId: NavItemId, actionId: QuickActionId, router: { navigate: (href: Href) => void; push: (href: Href) => void }) {
  if (actionId === "none") return;
  if (navId === "tasks") {
    const stamp = Date.now().toString(); // nudge param changes to refresh when already on screen
    switch (actionId) {
      case "new_task":
        router.push("/add-assignment");
        return;
      case "due_today":
        router.push({ pathname: "/(tabs)/tasks/tasks", params: { filter: "today", t: stamp } });
        return;
      case "overdue":
        router.push({ pathname: "/(tabs)/tasks/tasks", params: { filter: "overdue", t: stamp } });
        return;
      case "completed":
        router.push({ pathname: "/completed-tasks", params: { t: stamp } });
        return;
      default:
        break;
    }
  }
  runQuickAction(actionId, router);
}

export function isNavItemId(value: string): value is NavItemId {
  return NAV_ITEM_IDS.includes(value as NavItemId);
}

export function isQuickActionId(value: string): value is QuickActionId {
  return QUICK_ACTION_IDS.includes(value as QuickActionId);
}
