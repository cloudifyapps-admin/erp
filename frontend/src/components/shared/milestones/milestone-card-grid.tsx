'use client'

import { Flag, Calendar, ListChecks, DollarSign } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import type { Milestone } from './types'
import { formatCurrency } from './types'

interface MilestoneCardGridProps {
  milestones: Milestone[]
  currency?: string
  showProject?: boolean
  onProjectClick?: (projectId: string) => void
}

export function MilestoneCardGrid({
  milestones,
  currency = '$',
  showProject = false,
  onProjectClick,
}: MilestoneCardGridProps) {
  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
        <Flag className="size-10 text-muted-foreground/30 mb-3" />
        <p className="text-[14px] font-medium text-muted-foreground mb-1">No milestones</p>
        <p className="text-[12px] text-muted-foreground/60">
          {showProject
            ? 'Milestones will appear here once projects have milestones.'
            : 'Define project milestones to track progress.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {milestones.map((m) => (
        <div key={m.id} className="rounded-lg border border-border/40 bg-card p-5 hover:bg-muted/10 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Flag className="size-4 text-amber-500 shrink-0" />
              <span className="text-[13px] font-semibold truncate">{m.title}</span>
            </div>
            <StatusBadge status={m.status} />
          </div>

          {showProject && m.project_name && (
            <button
              className="mt-1.5 text-[12px] text-primary hover:underline"
              onClick={() => onProjectClick?.(m.project_id!)}
            >
              {m.project_name}
            </button>
          )}

          {m.description && (
            <p className="mt-2 text-[12px] text-muted-foreground line-clamp-2">{m.description}</p>
          )}

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, m.progress ?? 0)}%` }}
              />
            </div>
            <span className="text-[12px] text-muted-foreground tabular-nums font-medium w-8 text-right">
              {m.progress ?? 0}%
            </span>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {m.due_date ? new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
            </span>
            {(m.task_count !== undefined) && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3" />
                {m.completed_tasks ?? 0}/{m.task_count} tasks
              </span>
            )}
            {(m.billing_amount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <DollarSign className="size-3" />
                {formatCurrency(m.billing_amount!, currency)}
                {m.billing_status && <StatusBadge status={m.billing_status} className="ml-1" />}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
