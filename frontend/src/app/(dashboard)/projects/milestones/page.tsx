'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import {
  AdvancedDataTable,
  type ServerColumnDef,
} from '@/components/shared/advanced-data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  MilestoneFilterBar,
  MilestoneCardGrid,
  MILESTONE_STATUS_OPTIONS,
  type Milestone,
  type Project,
  type MilestoneViewMode,
} from '@/components/shared/milestones'

const VIEW_STORAGE_KEY = 'global-milestones-view'

export default function MilestonesPage() {
  const router = useRouter()

  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<MilestoneViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(VIEW_STORAGE_KEY) as MilestoneViewMode) || 'table'
    }
    return 'table'
  })

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')

  // New milestone dialog
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newMsProject, setNewMsProject] = useState('')
  const [newMsTitle, setNewMsTitle] = useState('')
  const [newMsDue, setNewMsDue] = useState('')
  const [newMsStatus, setNewMsStatus] = useState('pending')
  const [newMsProgress, setNewMsProgress] = useState('')
  const [newMsIsBilling, setNewMsIsBilling] = useState(false)
  const [newMsBillingAmount, setNewMsBillingAmount] = useState('')

  const handleViewChange = (v: MilestoneViewMode) => {
    setViewMode(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 100 } })
      const projectsList = normalizePaginated<Project>(projRaw).items
      setProjects(projectsList)

      // Fetch milestones from all projects, applying status filter server-side
      const params: Record<string, string | number> = { page_size: 200 }
      if (filterStatus !== 'all') params.status = filterStatus

      const results = await Promise.allSettled(
        projectsList.map((proj) =>
          api.get(`/projects/${proj.id}/milestones`, { params }).then(({ data }) => {
            const items = normalizePaginated<Milestone>(data).items
            items.forEach((m) => { m.project_id = proj.id; m.project_name = proj.name })
            return items
          })
        )
      )

      const allMilestones: Milestone[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') allMilestones.push(...r.value)
      }
      setMilestones(allMilestones)
    } catch {
      toast.error('Failed to load milestones')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { fetchData() }, [fetchData])

  // Client-side search + date range filter
  const filtered = useMemo(() => {
    let result = milestones
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.project_name?.toLowerCase().includes(q)
      )
    }
    if (dueDateFrom) {
      result = result.filter((m) => m.due_date && m.due_date >= dueDateFrom)
    }
    if (dueDateTo) {
      result = result.filter((m) => m.due_date && m.due_date <= dueDateTo)
    }
    return result
  }, [milestones, search, dueDateFrom, dueDateTo])

  const activeFilterCount = [
    filterStatus !== 'all' ? 1 : 0,
    search.trim() ? 1 : 0,
    (dueDateFrom || dueDateTo) ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const clearFilters = () => { setSearch(''); setFilterStatus('all'); setDueDateFrom(''); setDueDateTo('') }

  const resetForm = () => {
    setNewMsProject(''); setNewMsTitle(''); setNewMsDue('')
    setNewMsStatus('pending'); setNewMsProgress('')
    setNewMsIsBilling(false); setNewMsBillingAmount('')
  }

  const handleCreate = async () => {
    if (!newMsTitle.trim() || !newMsProject) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${newMsProject}/milestones`, {
        title: newMsTitle,
        due_date: newMsDue || null,
        status: newMsStatus,
        progress: newMsProgress ? parseInt(newMsProgress) : 0,
        is_billing_milestone: newMsIsBilling,
        billing_amount: newMsIsBilling && newMsBillingAmount ? parseFloat(newMsBillingAmount) : null,
      })
      toast.success('Milestone created')
      resetForm()
      setShowForm(false)
      fetchData()
    } catch {
      toast.error('Failed to create milestone')
    } finally {
      setSubmitting(false)
    }
  }

  // Table columns (includes Project column for global view)
  const columns: ServerColumnDef<Milestone>[] = [
    {
      id: 'title',
      header: 'Milestone',
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      id: 'project_name',
      header: 'Project',
      cell: (row) => (
        <span
          className="text-primary hover:underline cursor-pointer"
          onClick={() => router.push(`/projects/${row.project_id}`)}
        >
          {row.project_name ?? '—'}
        </span>
      ),
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (row) => row.due_date ? new Date(row.due_date).toLocaleDateString() : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'progress',
      header: 'Progress',
      cell: (row) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, row.progress ?? 0)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
            {row.progress ?? 0}%
          </span>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Milestones"
        breadcrumbs={[{ label: 'Projects' }, { label: 'Milestones' }]}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground">
              {activeFilterCount > 0 && filtered.length !== milestones.length
                ? `${filtered.length} of ${milestones.length}`
                : milestones.length}{' '}
              milestones
            </span>
            <Button
              size="sm"
              className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Milestone
            </Button>
          </div>
        }
      />

      <MilestoneFilterBar
        search={search}
        onSearchChange={setSearch}
        status={filterStatus}
        onStatusChange={setFilterStatus}
        dueDateFrom={dueDateFrom}
        onDueDateFromChange={setDueDateFrom}
        dueDateTo={dueDateTo}
        onDueDateToChange={setDueDateTo}
        viewMode={viewMode}
        onViewModeChange={handleViewChange}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      {viewMode === 'table' ? (
        <AdvancedDataTable
          title="Milestones"
          columns={columns}
          data={filtered}
          pagination={{
            page: 1,
            per_page: filtered.length || 25,
            total: filtered.length,
            pages: 1,
          }}
          loading={loading}
          emptyMessage="No milestones found"
          emptyDescription="Milestones will appear here once projects have milestones."
          searchPlaceholder="Search milestones..."
          storageKey="projects-milestones"
        />
      ) : (
        <MilestoneCardGrid
          milestones={filtered}
          showProject
          onProjectClick={(id) => router.push(`/projects/${id}`)}
        />
      )}

      {/* New Milestone Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Milestone</DialogTitle>
            <DialogDescription>Create a new milestone and assign it to a project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-[13px]">Project *</Label>
              <Select value={newMsProject} onValueChange={setNewMsProject}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[13px]">Title *</Label>
              <Input value={newMsTitle} onChange={(e) => setNewMsTitle(e.target.value)} placeholder="Milestone title" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px]">Due Date</Label>
                <Input type="date" value={newMsDue} onChange={(e) => setNewMsDue(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[13px]">Status</Label>
                <Select value={newMsStatus} onValueChange={setNewMsStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MILESTONE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[13px]">Progress (0-100)</Label>
              <Input type="number" min="0" max="100" value={newMsProgress} onChange={(e) => setNewMsProgress(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="is-billing-global" checked={newMsIsBilling} onCheckedChange={(v) => setNewMsIsBilling(!!v)} />
              <Label htmlFor="is-billing-global" className="text-[13px] cursor-pointer">Is billing milestone</Label>
            </div>
            {newMsIsBilling && (
              <div>
                <Label className="text-[13px]">Billing Amount</Label>
                <Input type="number" step="0.01" value={newMsBillingAmount} onChange={(e) => setNewMsBillingAmount(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !newMsTitle.trim() || !newMsProject}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
