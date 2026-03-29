'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Clock,
  DollarSign,
  Calendar,
  Timer,
  FileText,
  User,
  FolderKanban,
  ListChecks,
} from 'lucide-react'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { format } from 'date-fns'

interface TimeLogEntry {
  id: number
  task_id: number
  project_id: number
  user_id: number
  hours: number
  log_date: string
  description: string
  is_billable: boolean
  started_at: string | null
  stopped_at: string | null
  created_at: string
  // enriched fields
  project_name?: string
  task_title?: string
  user_name?: string
}

interface Project {
  id: string
  name: string
}

interface Task {
  id: string
  title: string
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function TimeLogsPage() {
  const [logs, setLogs] = useState<TimeLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalHours, setTotalHours] = useState(0)
  const [billableHours, setBillableHours] = useState(0)
  const [totalEntries, setTotalEntries] = useState(0)

  // New time log dialog state
  const [showNewLog, setShowNewLog] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [newLogProject, setNewLogProject] = useState('')
  const [newLogTask, setNewLogTask] = useState('')
  const [newLogDescription, setNewLogDescription] = useState('')
  const [newLogDate, setNewLogDate] = useState('')
  const [newLogHours, setNewLogHours] = useState('')
  const [newLogBillable, setNewLogBillable] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: projRaw } = await api.get('/projects', { params: { page_size: 200 } })
      const projectsList = normalizePaginated<Project>(projRaw).items
      const projectMap = new Map(projectsList.map((p) => [String(p.id), p.name]))

      const allLogs: TimeLogEntry[] = []

      const results = await Promise.allSettled(
        projectsList.map(async (proj) => {
          const { data: logRaw } = await api.get(`/projects/${proj.id}/time-logs`, {
            params: { page_size: 200 },
          })
          return normalizePaginated<TimeLogEntry>(logRaw).items.map((log) => ({
            ...log,
            project_name: projectMap.get(String(log.project_id)) ?? `Project #${log.project_id}`,
          }))
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') allLogs.push(...result.value)
      }

      // Sort by log_date desc, then created_at desc
      allLogs.sort((a, b) => {
        const dateComp = (b.log_date ?? '').localeCompare(a.log_date ?? '')
        if (dateComp !== 0) return dateComp
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      })

      setLogs(allLogs)
      setTotalEntries(allLogs.length)
      setTotalHours(allLogs.reduce((sum, l) => sum + (l.hours ?? 0), 0))
      setBillableHours(allLogs.filter((l) => l.is_billable).reduce((sum, l) => sum + (l.hours ?? 0), 0))
    } catch {
      toast.error('Failed to load time logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch projects list for the dialog
  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/projects', { params: { page_size: 200 } })
      setProjects(normalizePaginated<Project>(data).items)
    } catch { /* silent */ }
  }, [])

  // Fetch tasks when project is selected
  useEffect(() => {
    if (!newLogProject) {
      setTasks([])
      setNewLogTask('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get(`/projects/${newLogProject}/tasks`, { params: { page_size: 200 } })
        if (!cancelled) setTasks(normalizePaginated<Task>(data).items)
      } catch {
        if (!cancelled) setTasks([])
      }
    })()
    return () => { cancelled = true }
  }, [newLogProject])

  const handleOpenNewLog = () => {
    fetchProjects()
    setShowNewLog(true)
  }

  const resetNewLogForm = () => {
    setNewLogProject('')
    setNewLogTask('')
    setNewLogDescription('')
    setNewLogDate('')
    setNewLogHours('')
    setNewLogBillable(false)
    setTasks([])
  }

  const handleCreateTimeLog = async () => {
    if (!newLogProject || !newLogHours) {
      toast.error('Project and hours are required')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/projects/${newLogProject}/time-logs`, {
        task_id: newLogTask ? parseInt(newLogTask) : null,
        description: newLogDescription || null,
        log_date: newLogDate || new Date().toISOString().split('T')[0],
        hours: parseFloat(newLogHours),
        is_billable: newLogBillable,
      })
      toast.success('Time log created')
      resetNewLogForm()
      setShowNewLog(false)
      fetchData()
    } catch {
      toast.error('Failed to create time log')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Time Logs"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Time Logs' }]}
        actions={
          <Button
            size="sm"
            className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]"
            onClick={handleOpenNewLog}
          >
            <Plus className="h-3.5 w-3.5" />
            New Time Log
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-xl font-bold tabular-nums">{formatHours(totalHours)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Billable Hours</p>
            <p className="text-xl font-bold tabular-nums">{formatHours(billableHours)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Entries</p>
            <p className="text-xl font-bold tabular-nums">{totalEntries}</p>
          </div>
        </div>
      </div>

      {/* Time Log Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center">
              <Clock className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground/80 mt-1">No time logs yet</p>
            <p className="text-xs text-muted-foreground">Start logging time against your projects and tasks.</p>
            <Button size="sm" className="mt-2 gap-1.5" onClick={handleOpenNewLog}>
              <Plus className="h-3.5 w-3.5" /> Log Time
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</div>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5" /> Project</div>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Description</div>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5 justify-end"><Clock className="h-3.5 w-3.5" /> Hours</div>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Billable</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={`${log.project_id}-${log.id}`}
                    className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-medium">
                        {log.log_date ? format(new Date(log.log_date), 'MMM d, yyyy') : '---'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-primary">{log.project_name}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="max-w-md">
                        <p className="truncate">{log.description || <span className="text-muted-foreground italic">No description</span>}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-semibold tabular-nums">{formatHours(log.hours ?? 0)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {log.is_billable ? (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                          Billable
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Time Log Dialog */}
      <Dialog open={showNewLog} onOpenChange={(open) => { setShowNewLog(open); if (!open) resetNewLogForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Time Log</DialogTitle>
            <DialogDescription>Log time against a project and optionally a task.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-[13px]">Project *</Label>
              <Select value={newLogProject} onValueChange={setNewLogProject}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newLogProject && tasks.length > 0 && (
              <div>
                <Label className="text-[13px]">Task</Label>
                <Select value={newLogTask} onValueChange={setNewLogTask}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a task (optional)" /></SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[13px]">Description</Label>
              <Textarea
                value={newLogDescription}
                onChange={(e) => setNewLogDescription(e.target.value)}
                placeholder="What did you work on?"
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[13px]">Log Date</Label>
                <Input type="date" value={newLogDate} onChange={(e) => setNewLogDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[13px]">Hours *</Label>
                <Input type="number" step="0.25" min="0" value={newLogHours} onChange={(e) => setNewLogHours(e.target.value)} placeholder="0" className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="is_billable"
                checked={newLogBillable}
                onCheckedChange={(checked) => setNewLogBillable(checked === true)}
              />
              <Label htmlFor="is_billable" className="text-[13px] cursor-pointer">Billable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewLog(false); resetNewLogForm() }} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreateTimeLog} disabled={submitting || !newLogProject || !newLogHours}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Log Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
