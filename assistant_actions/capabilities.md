# Assistant Capabilities

## Data the assistant can read
- Tasks with title, notes, subject, difficulty, due date, completion state.
- Counts: open, overdue, due today, due this week, completed.
- Reminder settings (alerts enabled + reminder time).
- Navigation quick-action mapping.

## Actions the assistant can execute
- Navigate to any tab/route (e.g., Tasks, Planner, Calendar, Settings, Completed Tasks).
- Apply Tasks filter via navigation params (all/today/week/overdue).
- Create, update, complete, delete a task (confirmation recommended for deletes).
- Refresh planner data (via provided callback).
- Toggle alerts on/off and set reminder time.
- Open completed tasks view.
- Update nav quick actions (e.g., set Tasks quick action to “completed”).

## Safety
- Destructive actions (delete) should ask for confirmation before executing.
- All actions use existing app services (database, notifications, navigation) for consistency.
