/** Client-safe: the Kanban columns. Kept out of db.ts so browser bundles do
 *  not pull in node:sqlite. */

export type Stage =
  | 'new'
  | 'engaged'
  | 'qualified'
  | 'escalated'
  | 'contacted'
  | 'won'
  | 'lost';

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'new', label: 'New', hint: 'Just messaged, not yet qualified' },
  { id: 'engaged', label: 'Engaged', hint: 'Asking questions, bot is helping' },
  { id: 'qualified', label: 'Qualified', hint: 'Name, city and profile captured' },
  { id: 'escalated', label: 'Needs Team', hint: 'Bot handed over — team must call' },
  { id: 'contacted', label: 'Team Contacted', hint: 'A team member has reached out' },
  { id: 'won', label: 'Joined', hint: 'Enrolled in an FSP program' },
  { id: 'lost', label: 'Closed', hint: 'Not interested or unreachable' },
];

/** Stage ordering, so the bot never pulls a lead backwards. */
export const STAGE_RANK: Record<Stage, number> = {
  new: 0,
  engaged: 1,
  qualified: 2,
  escalated: 3,
  contacted: 4,
  won: 5,
  lost: 5,
};
