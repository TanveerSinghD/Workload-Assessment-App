import { db, getOrCreateActiveUser } from "@/lib/database";
import {
  DEFAULT_NAV_QUICK_ACTIONS,
  NavItemId,
  QuickActionId,
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
  rows.forEach((row) => {
    if (isNavItemId(row.nav_id) && isQuickActionId(row.action_id)) {
      map[row.nav_id] = row.action_id;
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
