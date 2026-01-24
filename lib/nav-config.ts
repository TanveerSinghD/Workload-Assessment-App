import { Href } from "expo-router";

export type NavItemId = "home" | "tasks" | "planner" | "calendar" | "settings";

export type QuickActionId =
  | "goHome"
  | "openTasks"
  | "openTasksToday"
  | "openTasksOverdue"
  | "addTask"
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
  goHome: {
    label: "Go to Home",
    run: (router) => router.navigate("/(tabs)/index/index"),
  },
  openTasks: {
    label: "Open Tasks",
    run: (router) => router.navigate("/(tabs)/tasks/tasks"),
  },
  openTasksToday: {
    label: "Tasks due today",
    run: (router) => router.push({ pathname: "/tasks-filter", params: { filter: "today" } }),
  },
  openTasksOverdue: {
    label: "Overdue tasks",
    run: (router) => router.push({ pathname: "/tasks-filter", params: { filter: "overdue" } }),
  },
  addTask: {
    label: "New task",
    run: (router) => router.push("/add-assignment"),
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
    defaultQuickAction: "goHome",
    quickActions: ["goHome", "openTasks", "openTasksToday", "openTasksOverdue", "addTask", "openPlanner"],
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: "checklist",
    routeName: "tasks/tasks",
    routePath: "/tasks/tasks",
    defaultQuickAction: "addTask",
    quickActions: ["addTask", "openTasks", "openTasksToday", "openTasksOverdue", "openCompleted"],
  },
  {
    id: "planner",
    label: "Planner",
    icon: "pencil.and.outline",
    routeName: "planner/planner",
    routePath: "/planner/planner",
    defaultQuickAction: "openPlanner",
    quickActions: ["openPlanner", "addTask", "openTasks", "openCalendar"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "calendar",
    routeName: "calendar/calendar",
    routePath: "/calendar/calendar",
    defaultQuickAction: "openCalendar",
    quickActions: ["openCalendar", "addTask", "openTasks", "openPlanner"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "gearshape.fill",
    routeName: "settings/settings",
    routePath: "/settings/settings",
    defaultQuickAction: "openSettings",
    quickActions: ["openSettings", "openCompleted", "addTask"],
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

export function isNavItemId(value: string): value is NavItemId {
  return NAV_ITEM_IDS.includes(value as NavItemId);
}

export function isQuickActionId(value: string): value is QuickActionId {
  return QUICK_ACTION_IDS.includes(value as QuickActionId);
}
