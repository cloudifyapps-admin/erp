'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import type { Milestone, ProjectMember } from './types'
import { PRIORITY_OPTIONS } from './types'

interface TaskFilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  priority: string
  onPriorityChange: (v: string) => void
  assignee?: string
  onAssigneeChange?: (v: string) => void
  milestoneId?: string
  onMilestoneChange?: (v: string) => void
  milestones?: Milestone[]
  members?: ProjectMember[]
  activeFilterCount: number
  onClearFilters: () => void
}

export function TaskFilterBar({
  search, onSearchChange,
  priority, onPriorityChange,
  assignee, onAssigneeChange,
  milestoneId, onMilestoneChange,
  milestones = [], members = [],
  activeFilterCount, onClearFilters,
}: TaskFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-9 text-[13px]"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Priority Filter */}
      <Select value={priority} onValueChange={onPriorityChange}>
        <SelectTrigger className="h-9 w-[140px] text-[13px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {PRIORITY_OPTIONS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee Filter */}
      {members.length > 0 && onAssigneeChange && (
        <Select value={assignee ?? 'all'} onValueChange={onAssigneeChange}>
          <SelectTrigger className="h-9 w-[160px] text-[13px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={String(m.user_id)} value={String(m.user_id)}>
                {m.user_name || `User ${m.user_id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Milestone Filter */}
      {milestones.length > 0 && onMilestoneChange && (
        <Select value={milestoneId ?? 'all'} onValueChange={onMilestoneChange}>
          <SelectTrigger className="h-9 w-[160px] text-[13px]">
            <SelectValue placeholder="Milestone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Milestones</SelectItem>
            {milestones.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9 text-[12px] gap-1.5 text-muted-foreground hover:text-foreground">
          <X className="size-3" />
          Clear filters ({activeFilterCount})
        </Button>
      )}
    </div>
  )
}
