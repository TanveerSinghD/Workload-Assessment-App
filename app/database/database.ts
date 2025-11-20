import { openDatabaseSync } from "expo-sqlite";

// Open database
export const db = openDatabaseSync("tasks.db");

// Create table
export function initDatabase() {
  db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT,
      difficulty TEXT,
      due_date TEXT,
      notes TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT
    );
  `);
}

// Add a task
export async function addTask(task: {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
}) {
  const { title, description, difficulty, due_date } = task;

  await db.runAsync(
    `
      INSERT INTO tasks (title, notes, difficulty, due_date, created_at)
      VALUES (?, ?, ?, ?, datetime('now'));
    `,
    [title, description, difficulty, due_date]
  );
}

// Load all tasks
export async function getTasks() {
  const result = await db.getAllAsync("SELECT * FROM tasks ORDER BY created_at DESC");
  return result;
}

// Load single task
export async function getTask(id: number) {
  const result = await db.getFirstAsync("SELECT * FROM tasks WHERE id = ?", [id]);
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

  await db.runAsync(
    `
      UPDATE tasks
      SET title = ?, notes = ?, difficulty = ?, due_date = ?
      WHERE id = ?
    `,
    [title, notes, difficulty, due_date, id]
  );
}

// Delete a single task
export async function deleteTask(id: number) {
  await db.runAsync("DELETE FROM tasks WHERE id = ?", [id]);
}

// Toggle completed flag
export async function setTaskCompleted(id: number, completed: boolean) {
  await db.runAsync("UPDATE tasks SET completed = ? WHERE id = ?", [completed ? 1 : 0, id]);
}

// Duplicate a task row (appends "(copy)" to the title)
export async function duplicateTask(id: number) {
  const original = await getTask(id);
  if (!original) return;

  const copyTitle = `${original.title} (copy)`;
  await db.runAsync(
    `
      INSERT INTO tasks (title, notes, difficulty, due_date, created_at, completed, subject)
      VALUES (?, ?, ?, ?, datetime('now'), 0, ?);
    `,
    [copyTitle, original.notes, original.difficulty, original.due_date, original.subject]
  );
}

// ⭐ DELETE ALL TASKS (for settings page)
export async function deleteAllTasks() {
  await db.runAsync("DELETE FROM tasks");
}
