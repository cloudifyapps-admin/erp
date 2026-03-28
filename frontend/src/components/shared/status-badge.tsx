import { cn } from '@/lib/utils'

type StatusBadgeProps = {
  status: string
  className?: string
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase().replace(/[-\s]/g, '_')

  const colorMap: Record<string, string> = {
    // gray
    new: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    planning: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    todo: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    // blue
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    present: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    // indigo
    sent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    submitted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    // green
    qualified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    // red
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    terminated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    // orange
    overdue: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    urgent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    // purple
    converted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    won: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    // yellow
    expired: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    inactive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  }

  return colorMap[s] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        getStatusColor(status),
        className
      )}
    >
      {label}
    </span>
  )
}
