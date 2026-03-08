export type ActionType =
  | "NAVIGATE"
  | "SET_TASK_FILTER"
  | "CREATE_TASK"
  | "UPDATE_TASK"
  | "COMPLETE_TASK"
  | "DELETE_TASK"
  | "REFRESH_PLAN"
  | "OPEN_COMPLETED_TASKS"
  | "SET_SETTING"
  | "UPDATE_NAV_QUICK_ACTION";

export type AssistantAction =
  | { type: "NAVIGATE"; payload: { route: string; params?: Record<string, any> } }
  | { type: "SET_TASK_FILTER"; payload: { filter: "all" | "today" | "week" | "overdue" } }
  | {
      type: "CREATE_TASK";
      payload: {
        title: string;
        description?: string;
        difficulty?: "easy" | "medium" | "hard";
        due_date?: string | null;
        priority?: "normal" | "high";
        category?: "coursework" | "revision" | "project" | "personal" | null;
      };
    }
  | {
      type: "UPDATE_TASK";
      payload: {
        id: number;
        title?: string;
        notes?: string;
        difficulty?: "easy" | "medium" | "hard";
        due_date?: string | null;
      };
    }
  | { type: "COMPLETE_TASK"; payload: { id: number; value?: boolean } }
  | { type: "DELETE_TASK"; payload: { id: number } }
  | { type: "REFRESH_PLAN" }
  | { type: "OPEN_COMPLETED_TASKS" }
  | { type: "SET_SETTING"; payload: { key: "notificationsEnabled"; value: boolean; reminderTime?: { hour: number; minute: number } } }
  | { type: "UPDATE_NAV_QUICK_ACTION"; payload: { navId: string; actionId: string } };

export type AssistantResponse = {
  message: string;
  tasks?: { id: number; title: string; due_date?: string | null; difficulty?: string }[];
  actions?: AssistantAction[];
  requiresConfirmation?: boolean;
};
