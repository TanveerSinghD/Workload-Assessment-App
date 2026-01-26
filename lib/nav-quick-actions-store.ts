import { db, getOrCreateActiveUser } from "@/lib/database";
import {
  DEFAULT_NAV_QUICK_ACTIONS,
  NavItemId,
  QuickActionId,
  navItems,
  isNavItemId,
  isQuickActionId,
} from "@/lib/nav-config";

const TABLE = "nav_quick_actions";

async function ensureTable() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      nav_id TEXT NOT NULL,
      action_id TEXT NOT NULL,
      user_id INTEGER,
      PRIMARY KEY (nav_id, user_id)
    );
  `);
}

async function getUserId() {
  const user = await getOrCreateActiveUser();
  return user?.id ?? null;
}

export async function loadNavQuickActions(): Promise<Record<NavItemId, QuickActionId>> {
  await ensureTable();
  const userId = await getUserId();

  const rows = await db.getAllAsync<{ nav_id: string; action_id: string; user_id: number | null }>(
    `SELECT nav_id, action_id, user_id FROM ${TABLE} WHERE user_id IS ?`,
    [userId]
  );

  const map = { ...DEFAULT_NAV_QUICK_ACTIONS };
  const allowedByNav = navItems.reduce<Record<NavItemId, QuickActionId[]>>((acc, nav) => {
    acc[nav.id] = nav.quickActions;
    return acc;
  }, {} as Record<NavItemId, QuickActionId[]>);

  rows.forEach((row) => {
    if (isNavItemId(row.nav_id) && isQuickActionId(row.action_id)) {
      const allowed = allowedByNav[row.nav_id] || [];
      map[row.nav_id] = allowed.includes(row.action_id) ? row.action_id : DEFAULT_NAV_QUICK_ACTIONS[row.nav_id];
    }
    // Legacy migrations: old action ids -> new ones
    if (isNavItemId(row.nav_id)) {
      const legacyMap: Record<string, QuickActionId> = {
        addTask: "new_task",
        openTasksToday: "due_today",
        openTasksOverdue: "overdue",
        openCompleted: "completed",
        openTasks: "new_task",
      };
      const legacy = legacyMap[row.action_id];
      if (legacy && allowedByNav[row.nav_id]?.includes(legacy)) {
        map[row.nav_id] = legacy;
      }
    }
  });

  return map;
}

export async function saveNavQuickAction(navId: NavItemId, actionId: QuickActionId) {
  await ensureTable();
  const userId = await getUserId();
  await db.runAsync(
    `
      INSERT INTO ${TABLE} (nav_id, action_id, user_id)
      VALUES (?, ?, ?)
      ON CONFLICT(nav_id, user_id) DO UPDATE SET action_id = excluded.action_id;
    `,
    [navId, actionId, userId]
  );
}
