export type AuthProvider = "email" | "apple" | "google" | "local";

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  provider: AuthProvider;
  password?: string | null;
  created_at?: string | null;
};

export type TaskRow = {
  id: number;
  title: string;
  subject: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  priority: "normal" | "high" | null;
  category: "coursework" | "revision" | "project" | "personal" | null;
  due_date: string | null;
  notes: string | null;
  completed: number;
  created_at: string;
  user_id: number | null;
};

type SessionRow = {
  user_id: number | null;
  signed_out: number;
  updated_at: string | null;
};

type WebDatabaseState = {
  users: UserProfile[];
  tasks: TaskRow[];
  session: SessionRow | null;
  nextUserId: number;
  nextTaskId: number;
};

const STORAGE_KEY = "workloadassapp.web.database.v1";

const defaultState = (): WebDatabaseState => ({
  users: [],
  tasks: [],
  session: null,
  nextUserId: 1,
  nextTaskId: 1,
});

let memoryState: WebDatabaseState = defaultState();

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cloneState(state: WebDatabaseState): WebDatabaseState {
  return {
    users: state.users.map((user) => ({ ...user })),
    tasks: state.tasks.map((task) => ({ ...task })),
    session: state.session ? { ...state.session } : null,
    nextUserId: state.nextUserId,
    nextTaskId: state.nextTaskId,
  };
}

function readState(): WebDatabaseState {
  if (!hasLocalStorage()) {
    return cloneState(memoryState);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<WebDatabaseState>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      session: parsed.session
        ? {
            user_id: parsed.session.user_id ?? null,
            signed_out: parsed.session.signed_out === 1 ? 1 : 0,
            updated_at: parsed.session.updated_at ?? null,
          }
        : null,
      nextUserId: Number.isFinite(parsed.nextUserId) ? Number(parsed.nextUserId) : 1,
      nextTaskId: Number.isFinite(parsed.nextTaskId) ? Number(parsed.nextTaskId) : 1,
    };
  } catch {
    return defaultState();
  }
}

function writeState(state: WebDatabaseState) {
  memoryState = cloneState(state);
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateState(mutator: (state: WebDatabaseState) => void) {
  const state = readState();
  mutator(state);
  writeState(state);
  return state;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isSignedOut(session: SessionRow | null) {
  return session?.signed_out === 1;
}

function findUserByEmailFromState(state: WebDatabaseState, email: string) {
  const normalized = normalizeEmail(email);
  return state.users.find((user) => normalizeEmail(user.email) === normalized) ?? null;
}

function getUserById(state: WebDatabaseState, userId: number | null | undefined) {
  if (!userId) return null;
  return state.users.find((user) => user.id === userId) ?? null;
}

function setActiveUserInState(state: WebDatabaseState, userId: number) {
  state.session = {
    user_id: userId,
    signed_out: 0,
    updated_at: nowIso(),
  };
}

async function ensureActiveUser(options?: { ignoreSignedOut?: boolean }): Promise<UserProfile | null> {
  const ignoreSignedOut = options?.ignoreSignedOut === true;
  let result: UserProfile | null = null;

  updateState((state) => {
    if (!ignoreSignedOut && isSignedOut(state.session)) {
      result = null;
      return;
    }

    const existing = getUserById(state, state.session?.user_id);
    if (existing) {
      result = { ...existing };
      return;
    }

    const fallback = state.users[0] ?? null;
    if (fallback) {
      setActiveUserInState(state, fallback.id);
      result = { ...fallback };
      return;
    }

    const guest: UserProfile = {
      id: state.nextUserId++,
      name: "Guest",
      email: "guest@local",
      provider: "local",
      password: null,
      created_at: nowIso(),
    };
    state.users.push(guest);
    setActiveUserInState(state, guest.id);
    result = { ...guest };
  });

  return result;
}

async function getActiveUserId() {
  const user = await ensureActiveUser();
  if (user?.id) return user.id;
  const recovered = await ensureActiveUser({ ignoreSignedOut: true });
  return recovered?.id ?? null;
}

export const db = null;

export async function initDatabase() {
  const state = readState();
  if (state.nextUserId < 1) state.nextUserId = 1;
  if (state.nextTaskId < 1) state.nextTaskId = 1;
  writeState(state);
}

export async function getOrCreateActiveUser(): Promise<UserProfile | null> {
  return ensureActiveUser();
}

export async function signOutUser() {
  updateState((state) => {
    state.session = {
      user_id: null,
      signed_out: 1,
      updated_at: nowIso(),
    };
  });
}

export async function getActiveUser(): Promise<UserProfile | null> {
  const state = readState();
  if (isSignedOut(state.session)) return null;
  const user = getUserById(state, state.session?.user_id);
  return user ? { ...user } : null;
}

export async function adoptOrphanTasks(userId: number) {
  updateState((state) => {
    state.tasks = state.tasks.map((task) =>
      task.user_id == null ? { ...task, user_id: userId } : task
    );
  });
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  let created: UserProfile | null = null;

  updateState((state) => {
    const normalizedEmail = normalizeEmail(email);
    const existing = findUserByEmailFromState(state, normalizedEmail);
    if (existing) {
      throw new Error("Email already registered.");
    }

    created = {
      id: state.nextUserId++,
      name: name.trim(),
      email: normalizedEmail,
      provider: "email",
      password,
      created_at: nowIso(),
    };

    state.users.push(created);
    setActiveUserInState(state, created.id);
  });

  return created;
}

export async function signInWithEmail(email: string, password: string) {
  let user: UserProfile | null = null;

  updateState((state) => {
    const existing = findUserByEmailFromState(state, email);
    if (!existing) return;
    if ((existing.password ?? "") !== password) return;
    setActiveUserInState(state, existing.id);
    user = { ...existing };
  });

  return user;
}

export async function signInWithProvider(
  provider: AuthProvider,
  profile: { email?: string; name?: string } = {}
) {
  let user: UserProfile | null = null;

  updateState((state) => {
    const normalizedEmail = profile.email ? normalizeEmail(profile.email) : null;
    const fallbackEmail = normalizedEmail ?? `${provider}-${Date.now()}@local`;
    const existing = findUserByEmailFromState(state, fallbackEmail);

    if (existing) {
      setActiveUserInState(state, existing.id);
      user = { ...existing };
      return;
    }

    user = {
      id: state.nextUserId++,
      name: profile.name?.trim() || `${provider === "apple" ? "Apple" : "Google"} user`,
      email: fallbackEmail,
      provider,
      password: null,
      created_at: nowIso(),
    };
    state.users.push(user);
    setActiveUserInState(state, user.id);
  });

  return user;
}

export async function addTask(task: {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
  priority?: "normal" | "high";
  category?: "coursework" | "revision" | "project" | "personal" | null;
}) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks.push({
      id: state.nextTaskId++,
      title: task.title,
      subject: null,
      difficulty: task.difficulty,
      priority: task.priority ?? "normal",
      category: task.category ?? null,
      due_date: task.due_date,
      notes: task.description,
      completed: 0,
      created_at: nowIso(),
      user_id: userId,
    });
  });
}

export async function getTasks() {
  const userId = await getActiveUserId();
  if (!userId) return [];
  const state = readState();
  return state.tasks
    .filter((task) => task.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((task) => ({ ...task }));
}

export async function getTask(id: number) {
  const userId = await getActiveUserId();
  if (!userId) return null;
  const state = readState();
  const task = state.tasks.find((entry) => entry.id === id && entry.user_id === userId);
  return task ? { ...task } : null;
}

export async function updateTask(task: {
  id: number;
  title: string;
  notes: string;
  difficulty: "easy" | "medium" | "hard";
  due_date: string | null;
  priority?: "normal" | "high";
  category?: "coursework" | "revision" | "project" | "personal" | null;
}) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks = state.tasks.map((entry) => {
      if (entry.id !== task.id || entry.user_id !== userId) return entry;
      return {
        ...entry,
        title: task.title,
        notes: task.notes,
        difficulty: task.difficulty,
        due_date: task.due_date,
        priority: task.priority ?? entry.priority ?? "normal",
        category: task.category !== undefined ? task.category : entry.category,
      };
    });
  });
}

export async function updateTaskDueDate(id: number, due_date: string | null) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks = state.tasks.map((entry) =>
      entry.id === id && entry.user_id === userId ? { ...entry, due_date } : entry
    );
  });
}

export async function updateManyTaskDueDates(updates: { id: number; due_date: string | null }[]) {
  if (!updates.length) return;
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");
  const dueDates = new Map(updates.map((entry) => [entry.id, entry.due_date]));

  updateState((state) => {
    state.tasks = state.tasks.map((entry) => {
      if (entry.user_id !== userId || !dueDates.has(entry.id)) return entry;
      return { ...entry, due_date: dueDates.get(entry.id) ?? null };
    });
  });
}

export async function deleteTask(id: number) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks = state.tasks.filter((entry) => !(entry.id === id && entry.user_id === userId));
  });
}

export async function setTaskCompleted(id: number, completed: boolean) {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks = state.tasks.map((entry) =>
      entry.id === id && entry.user_id === userId
        ? { ...entry, completed: completed ? 1 : 0 }
        : entry
    );
  });
}

export async function duplicateTask(id: number) {
  const original = await getTask(id);
  if (!original) return;
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks.push({
      ...original,
      id: state.nextTaskId++,
      title: `${original.title} (copy)`,
      completed: 0,
      created_at: nowIso(),
      user_id: userId,
    });
  });
}

export async function deleteAllTasks() {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks = state.tasks.filter((entry) => entry.user_id !== userId);
  });
}

export async function deleteCompletedTasks() {
  const userId = await getActiveUserId();
  if (!userId) throw new Error("No active user session");

  updateState((state) => {
    state.tasks = state.tasks.filter((entry) => !(entry.user_id === userId && entry.completed === 1));
  });
}
