import { openDatabaseSync } from "expo-sqlite";

export type AuthProvider = "email" | "apple" | "google";

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  provider: AuthProvider;
  password?: string | null;
  created_at?: string | null;
};

// Open database
export const db = openDatabaseSync("tasks.db");

async function ensureColumnExists(table: string, column: string, definition: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  const hasColumn = columns?.some((col) => col.name === column);
  if (!hasColumn) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

// Create tables + migrations
export async function initDatabase() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      provider TEXT,
      password TEXT,
      created_at TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id INTEGER,
      updated_at TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT,
      difficulty TEXT,
      due_date TEXT,
      notes TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT,
      user_id INTEGER
    );
  `);

  // Old installs won't have user scoping yet
  await ensureColumnExists("tasks", "user_id", "INTEGER");
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return db.getFirstAsync<UserProfile>(
    "SELECT id, name, email, provider, password, created_at FROM users WHERE email = ?",
    [normalized]
  );
}

async function setActiveUser(userId: number) {
  await db.runAsync(
    `
      INSERT INTO sessions (id, user_id, updated_at)
      VALUES (1, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at;
    `,
    [userId]
  );
}

async function ensureActiveUser(): Promise<UserProfile | null> {
  // Try existing session
  const current = await getActiveUser();
  if (current) return current;

  // Rehydrate from first user if session was cleared
  const fallback = await db.getFirstAsync<UserProfile>(
    "SELECT id, name, email, provider, password, created_at FROM users ORDER BY id LIMIT 1"
  );
  if (fallback) {
    await setActiveUser(fallback.id);
    return fallback;
  }

  // Create a local guest so the app remains usable without manual signup
  await db.runAsync(
    `
      INSERT INTO users (name, email, provider, password, created_at)
      VALUES ('Guest', 'guest@local', 'local', NULL, datetime('now'))
    `
  );

  const guest = await db.getFirstAsync<UserProfile>(
    "SELECT id, name, email, provider, password, created_at FROM users WHERE email = 'guest@local'"
  );
  if (guest) {
    await setActiveUser(guest.id);
  }
  return guest ?? null;
}

export async function getOrCreateActiveUser(): Promise<UserProfile | null> {
  return ensureActiveUser();
}

export async function signOutUser() {
  await db.runAsync("DELETE FROM sessions WHERE id = 1");
}

export async function getActiveUser(): Promise<UserProfile | null> {
  const session = await db.getFirstAsync<{ user_id?: number }>(
    "SELECT user_id FROM sessions WHERE id = 1"
  );
  if (!session?.user_id) return null;

  const user = await db.getFirstAsync<UserProfile>(
    "SELECT id, name, email, provider, password, created_at FROM users WHERE id = ?",
    [session.user_id]
  );
  return user ?? null;
}

async function getActiveUserId() {
  const user = await ensureActiveUser();
  return user?.id ?? null;
}

export async function adoptOrphanTasks(userId: number) {
  await db.runAsync("UPDATE tasks SET user_id = ? WHERE user_id IS NULL", [userId]);
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error("Email already registered.");
  }

  await db.runAsync(
    `
      INSERT INTO users (name, email, provider, password, created_at)
      VALUES (?, ?, 'email', ?, datetime('now'))
    `,
    [name.trim(), normalizedEmail, password]
  );

  const user = await findUserByEmail(normalizedEmail);
  if (user) {
    await setActiveUser(user.id);
  }
  return user;
}

export async function signInWithEmail(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if ((user.password ?? "") !== password) return null;

  await setActiveUser(user.id);
  return user;
}

export async function signInWithProvider(
  provider: AuthProvider,
  profile: { email?: string; name?: string } = {}
) {
  const normalizedEmail = profile.email ? normalizeEmail(profile.email) : null;
  const fallbackEmail = normalizedEmail ?? `${provider}-${Date.now()}@local`;
  let user = await findUserByEmail(normalizedEmail ?? fallbackEmail);

  if (!user) {
    await db.runAsync(
      `
        INSERT INTO users (name, email, provider, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `,
      [
        profile.name?.trim() || `${provider === "apple" ? "Apple" : "Google"} user`,
        fallbackEmail,
        provider,
      ]
    );
    user = await findUserByEmail(fallbackEmail);
  }

  if (user) {
    await setActiveUser(user.id);
  }
  return user;
}

// Add a task
export async function addTask(task: {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
}) {
  const { title, description, difficulty, due_date } = task;
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  await db.runAsync(
    `
      INSERT INTO tasks (title, notes, difficulty, due_date, created_at, user_id)
      VALUES (?, ?, ?, ?, datetime('now'), ?);
    `,
    [title, description, difficulty, due_date, userId]
  );
}

// Load all tasks for the active user
export async function getTasks() {
  const userId = await getActiveUserId();
  if (!userId) return [];
  const result = await db.getAllAsync("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC", [
    userId,
  ]);
  return result;
}

// Load single task
export async function getTask(id: number) {
  const userId = await getActiveUserId();
  if (!userId) return null;
  const result = await db.getFirstAsync("SELECT * FROM tasks WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  return result;
}

// Update a task
export async function updateTask(task: {
  id: number;
  title: string;
  notes: string;
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
}) {
  const { id, title, notes, difficulty, due_date } = task;
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  await db.runAsync(
    `
      UPDATE tasks
      SET title = ?, notes = ?, difficulty = ?, due_date = ?
      WHERE id = ? AND user_id = ?
    `,
    [title, notes, difficulty, due_date, id, userId]
  );
}

// Delete a single task
export async function deleteTask(id: number) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");
  await db.runAsync("DELETE FROM tasks WHERE id = ? AND user_id = ?", [id, userId]);
}

// Toggle completed flag
export async function setTaskCompleted(id: number, completed: boolean) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");
  await db.runAsync("UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?", [
    completed ? 1 : 0,
    id,
    userId,
  ]);
}

// Duplicate a task row (appends "(copy)" to the title)
export async function duplicateTask(id: number) {
  const original = await getTask(id);
  if (!original) return;

  const copyTitle = `${original.title} (copy)`;
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  await db.runAsync(
    `
      INSERT INTO tasks (title, notes, difficulty, due_date, created_at, completed, subject, user_id)
      VALUES (?, ?, ?, ?, datetime('now'), 0, ?, ?);
    `,
    [copyTitle, original.notes, original.difficulty, original.due_date, original.subject, userId]
  );
}

export async function deleteAllTasks() {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");
  await db.runAsync("DELETE FROM tasks WHERE user_id = ?", [userId]);
}

// Delete only completed tasks
export async function deleteCompletedTasks() {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");
  await db.runAsync("DELETE FROM tasks WHERE completed = 1 AND user_id = ?", [userId]);
}
