/* ── Shared Milestone Types & Constants ───────────────────────────── */

export interface Milestone {
  id: string
  title: string
  description?: string
  due_date?: string
  status: string
  progress: number
  sort_order?: number
  completed_at?: string
  is_billing_milestone?: boolean
  billing_amount?: number
  billing_status?: string
  task_count?: number
  completed_tasks?: number
  project_id?: string
  project_name?: string
}

export interface Project {
  id: string
  name: string
  currency?: string
}

export const MILESTONE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
] as const

export function formatCurrency(amount: number, currency: string = '$') {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
