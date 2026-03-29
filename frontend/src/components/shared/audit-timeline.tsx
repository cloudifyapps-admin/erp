'use client'

import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Users,
  FileText,
  Pin,
  StickyNote,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type AuditTimelineProps = {
  entityType: string
  entityId: number
}

type FieldChange = {
  field: string
  old_value: string | null
  new_value: string | null
}

type TimelineEntry = {
  id: number
  type: 'audit' | 'activity' | 'note'
  timestamp: string
  user: string
  // audit fields
  action?: 'create' | 'update' | 'delete'
  changes?: FieldChange[]
  // activity fields
  activity_type?: string
  subject?: string
  description?: string
  outcome?: string
  status?: string
  // note fields
  content?: string
  pinned?: boolean
}

type TimelineResponse = {
  items: TimelineEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

const activityIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  chat: MessageSquare,
  visit: Users,
  task: CheckCircle2,
}

function getDotColor(entry: TimelineEntry): string {
  if (entry.type === 'audit') {
    switch (entry.action) {
      case 'create':
        return 'bg-green-500'
      case 'update':
        return 'bg-blue-500'
      case 'delete':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }
  if (entry.type === 'activity') return 'bg-blue-500'
  return 'bg-gray-400'
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function AuditEntry({ entry }: { entry: TimelineEntry }) {
  const ActionIcon =
    entry.action === 'create' ? Plus : entry.action === 'delete' ? Trash2 : Pencil

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="capitalize">{entry.action}</span>
        <span className="text-muted-foreground">by</span>
        <span>{entry.user}</span>
      </div>
      {entry.changes && entry.changes.length > 0 && (
        <div className="ml-5.5 space-y-0.5">
          {entry.changes.map((change, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatFieldName(change.field)}
              </span>
              :{' '}
              <span className="line-through">
                {change.old_value ?? '(empty)'}
              </span>
              {' \u2192 '}
              <span className="text-foreground">
                {change.new_value ?? '(empty)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityEntry({ entry }: { entry: TimelineEntry }) {
  const Icon = activityIcons[entry.activity_type ?? ''] ?? Clock

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{entry.subject}</span>
        {entry.status && <StatusBadge status={entry.status} />}
      </div>
      {entry.description && (
        <p className="ml-5.5 text-xs text-muted-foreground">
          {entry.description}
        </p>
      )}
      {entry.outcome && (
        <p className="ml-5.5 text-xs">
          <span className="font-medium">Outcome:</span>{' '}
          <span className="text-muted-foreground">{entry.outcome}</span>
        </p>
      )}
      <p className="ml-5.5 text-xs text-muted-foreground">by {entry.user}</p>
    </div>
  )
}

function NoteEntry({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        {entry.pinned ? (
          <Pin className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>Note</span>
        {entry.pinned && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Pinned
          </span>
        )}
      </div>
      <p className="ml-5.5 text-sm text-foreground whitespace-pre-wrap">
        {entry.content}
      </p>
      <p className="ml-5.5 text-xs text-muted-foreground">by {entry.user}</p>
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-12 w-px" />
          </div>
          <div className="flex-1 space-y-2 pb-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AuditTimeline({ entityType, entityId }: AuditTimelineProps) {
  const [page, setPage] = useState(1)
  const perPage = 50

  const { data, isLoading, isFetching } = useQuery<TimelineResponse>({
    queryKey: ['timeline', entityType, entityId, page],
    queryFn: async () => {
      const res = await api.get(
        `/v1/crm/${entityType}/${entityId}/timeline`,
        { params: { page, per_page: perPage } }
      )
      return res.data
    },
  })

  const handleLoadMore = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  if (isLoading) return <TimelineSkeleton />

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No timeline entries yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {data.items.map((entry, index) => {
        const isLast = index === data.items.length - 1

        return (
          <div key={`${entry.type}-${entry.id}`} className="flex gap-4">
            <div className="flex flex-col items-center pt-1">
              <div
                className={cn(
                  'h-3 w-3 rounded-full shrink-0 ring-4 ring-background',
                  getDotColor(entry)
                )}
              />
              {!isLast && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>
            <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <div className="mb-1">
                {entry.type === 'audit' && <AuditEntry entry={entry} />}
                {entry.type === 'activity' && <ActivityEntry entry={entry} />}
                {entry.type === 'note' && <NoteEntry entry={entry} />}
              </div>
              <p className="ml-5.5 text-[0.65rem] text-muted-foreground/70">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          </div>
        )
      })}

      {data.page < data.pages && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isFetching}
          >
            {isFetching ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
