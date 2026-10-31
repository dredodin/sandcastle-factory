// The Status options of the Kanban: the only five columns.

export const STATUSES = ["Backlog", "Ready for agent", "Agent working", "In review", "Done"] as const;
export type Status = (typeof STATUSES)[number];
