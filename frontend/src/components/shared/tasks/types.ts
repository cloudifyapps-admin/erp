/* ── Shared Task Types & Constants ─────────────────────────────────── */

export interface Task {
  id: string
  title: string
  description?: string
  project_id?: string
  project_name?: string
  status: string
  priority: string
  assignee_name: string
  assigned_to?: string
  assignee_id?: string
  due_date: string
  start_date?: string
  estimated_hours?: number
  actual_hours?: number
  progress?: number
  milestone_id?: string
  milestone_name?: string
  dependencies?: string[]
  is_critical?: boolean
  sort_order?: number
  order?: number
  wbs_code?: string
  created_at?: string
  completed_at?: string
  // Detail-only fields
  labels?: { label_id: number }[]
  checklist_total?: number
  checklist_done?: number
  dependency_count?: number
  comment_count?: number
  attachment_count?: number
}

export interface TaskComment {
  id: number
  body: string
  user_name?: string
  user_email?: string
  created_at: string
  created_by: number
}

export interface ChecklistItem {
  id: number
  title: string
  is_completed: boolean
  sort_order: number
}

export interface TaskAttachment {
  id: number
  file_name: string
  file_path: string
  mime_type: string
  file_size: number
  created_at: string
}

export interface Milestone {
  id: string
  name: string
}

export interface ProjectMember {
  id: string | number
  user_id: string | number
  user_name?: string
  role: string
}

export type PanelTab = 'details' | 'comments' | 'checklist' | 'attachments'

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

export const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
] as const

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}
