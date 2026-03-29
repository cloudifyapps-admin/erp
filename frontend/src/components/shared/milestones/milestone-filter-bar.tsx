'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Search, X, LayoutGrid, Table2, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { MILESTONE_STATUS_OPTIONS } from './types'

export type MilestoneViewMode = 'table' | 'card'

interface MilestoneFilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  dueDateFrom: string
  onDueDateFromChange: (v: string) => void
  dueDateTo: string
  onDueDateToChange: (v: string) => void
  viewMode: MilestoneViewMode
  onViewModeChange: (v: MilestoneViewMode) => void
  activeFilterCount: number
  onClearFilters: () => void
}

export function MilestoneFilterBar({
  search, onSearchChange,
  status, onStatusChange,
  dueDateFrom, onDueDateFromChange,
  dueDateTo, onDueDateToChange,
  viewMode, onViewModeChange,
  activeFilterCount, onClearFilters,
}: MilestoneFilterBarProps) {
  const [filterOpen, setFilterOpen] = useState(false)

  // Count only sidebar filters (exclude search)
  const sidebarFilterCount = [
    status !== 'all' ? 1 : 0,
    (dueDateFrom || dueDateTo) ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search milestones..."
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

        {/* Filter Button */}
        <Button
          variant={sidebarFilterCount > 0 ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 text-[13px] gap-1.5"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {sidebarFilterCount > 0 && (
            <span className="ml-0.5 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
              {sidebarFilterCount}
            </span>
          )}
        </Button>

        {/* Clear All Filters */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-9 text-[12px] gap-1.5 text-muted-foreground hover:text-foreground">
            <X className="size-3" />
            Clear filters ({activeFilterCount})
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* View Switcher */}
        <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            title="Table view"
          >
            <Table2 className="size-4" />
          </button>
          <button
            onClick={() => onViewModeChange('card')}
            className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            title="Card view"
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      {/* Filter Sidebar */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" className="w-[320px] sm:max-w-[320px]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow down milestones by status and due date.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 py-2 flex-1 overflow-y-auto">
            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium">Status</Label>
              <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {MILESTONE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date Range */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium">Due Date Range</Label>
              <div className="flex flex-col gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={dueDateFrom}
                    onChange={(e) => onDueDateFromChange(e.target.value)}
                    className="h-9 text-[13px] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={dueDateTo}
                    onChange={(e) => onDueDateToChange(e.target.value)}
                    className="h-9 text-[13px] mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={sidebarFilterCount === 0}
              onClick={() => {
                onStatusChange('all')
                onDueDateFromChange('')
                onDueDateToChange('')
              }}
            >
              Reset Filters
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setFilterOpen(false)}
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
