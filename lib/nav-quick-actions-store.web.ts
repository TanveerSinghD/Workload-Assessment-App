import { getOrCreateActiveUser } from "@/lib/database";
import {
  DEFAULT_NAV_QUICK_ACTIONS,
  NavItemId,
  QuickActionId,
  navItems,
  isNavItemId,
  isQuickActionId,
} from "@/lib/nav-config";

const STORAGE_KEY = "workloadassapp.web.nav-quick-actions.v1";

type NavQuickActionsState = Record<string, Partial<Record<NavItemId, QuickActionId>>>;

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readState(): NavQuickActionsState {
  if (!hasLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NavQuickActionsState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(state: NavQuickActionsState) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function getUserKey() {
  const user = await getOrCreateActiveUser();
  return String(user?.id ?? "guest");
}

export async function loadNavQuickActions(): Promise<Record<NavItemId, QuickActionId>> {
  const userKey = await getUserKey();
  const state = readState();
  const saved = state[userKey] ?? {};
  const map = { ...DEFAULT_NAV_QUICK_ACTIONS };
  const allowedByNav = navItems.reduce<Record<NavItemId, QuickActionId[]>>((acc, nav) => {
    acc[nav.id] = nav.quickActions;
    return acc;
  }, {} as Record<NavItemId, QuickActionId[]>);

  Object.entries(saved).forEach(([navId, actionId]) => {
    if (!isNavItemId(navId) || typeof actionId !== "string") return;

    let normalizedAction = actionId;
    const legacyMap: Record<string, QuickActionId> = {
      addTask: "new_task",
      openTasksToday: "due_today",
      openTasksOverdue: "overdue",
      openCompleted: "completed",
      openTasks: "new_task",
    };
    if (!isQuickActionId(normalizedAction) && legacyMap[normalizedAction]) {
      normalizedAction = legacyMap[normalizedAction];
    }
    if (!isQuickActionId(normalizedAction)) return;

    const allowed = allowedByNav[navId] || [];
    map[navId] = allowed.includes(normalizedAction) ? normalizedAction : DEFAULT_NAV_QUICK_ACTIONS[navId];
  });

  return map;
}

export async function saveNavQuickAction(navId: NavItemId, actionId: QuickActionId) {
  const userKey = await getUserKey();
  const state = readState();
  const nextState = {
    ...state,
    [userKey]: {
      ...(state[userKey] ?? {}),
      [navId]: actionId,
    },
  };
  writeState(nextState);
}
