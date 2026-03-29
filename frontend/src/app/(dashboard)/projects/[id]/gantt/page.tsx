'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { format, differenceInDays, addDays, parseISO } from 'date-fns'
import { Diamond, GanttChart as GanttChartIcon } from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────── */

interface Task {
  id: string; title: string; description: string; status: string; priority: string
  assignee_name: string; due_date: string; start_date: string; estimated_hours: number
  actual_hours: number; progress: number; is_critical: boolean; order: number
}

interface Milestone {
  id: string; title: string; description: string; due_date: string; status: string
  progress: number; billing_amount: number; billing_status: string; task_count: number; completed_tasks: number
}

interface Project {
  id: string; name: string; start_date: string; end_date: string
}

/* ── Gantt Chart Component ──────────────────────────────────────────── */

type GanttZoom = 'day' | 'week' | 'month'

function GanttChart({ tasks, milestones, projectStart, projectEnd }: {
  tasks: Task[]; milestones: Milestone[]; projectStart: string; projectEnd: string
}) {
  const [zoom, setZoom] = useState<GanttZoom>('week')
  const scrollRef = useRef<HTMLDivElement>(null)

  const start = projectStart ? parseISO(projectStart) : new Date()
  const end = projectEnd ? parseISO(projectEnd) : addDays(new Date(), 90)
  const totalDays = Math.max(differenceInDays(end, start), 30)

  const colWidth = zoom === 'day' ? 40 : zoom === 'week' ? 20 : 8
  const totalWidth = totalDays * colWidth

  const getPosition = (dateStr: string) => {
    if (!dateStr) return 0
    const d = parseISO(dateStr)
    return Math.max(0, differenceInDays(d, start)) * colWidth
  }

  const getBarWidth = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return colWidth * 7
    return Math.max(colWidth, differenceInDays(parseISO(endDate), parseISO(startDate)) * colWidth)
  }

  const headerDates = useMemo(() => {
    const dates: { label: string; left: number; width: number }[] = []
    if (zoom === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(start, i)
        dates.push({ label: format(d, 'd'), left: i * colWidth, width: colWidth })
      }
    } else if (zoom === 'week') {
      for (let i = 0; i < totalDays; i += 7) {
        const d = addDays(start, i)
        dates.push({ label: format(d, 'MMM d'), left: i * colWidth, width: 7 * colWidth })
      }
    } else {
      for (let i = 0; i < totalDays; i += 30) {
        const d = addDays(start, i)
        dates.push({ label: format(d, 'MMM yyyy'), left: i * colWidth, width: 30 * colWidth })
      }
    }
    return dates
  }, [zoom, totalDays, start, colWidth])

  const todayLeft = getPosition(new Date().toISOString())

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground">Zoom:</span>
        {(['day', 'week', 'month'] as GanttZoom[]).map((z) => (
          <Button key={z} variant={zoom === z ? 'default' : 'outline'} size="sm" className="h-7 text-[11px] px-3 capitalize" onClick={() => setZoom(z)}>
            {z}
          </Button>
        ))}
        <div className="flex items-center gap-3 ml-auto text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-primary inline-block" /> Task</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Critical</span>
          <span className="inline-flex items-center gap-1.5"><Diamond className="size-3 text-amber-500 fill-amber-500" /> Milestone</span>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="flex">
          <div className="w-[200px] shrink-0 border-r border-border/40 bg-muted/20">
            <div className="h-10 border-b border-border/40 px-3 flex items-center">
              <span className="text-[11px] font-medium text-muted-foreground">Task</span>
            </div>
            {tasks.map((t) => (
              <div key={t.id} className="h-9 border-b border-border/20 px-3 flex items-center">
                <span className="text-[12px] truncate" title={t.title}>{t.title}</span>
              </div>
            ))}
            {milestones.map((m) => (
              <div key={m.id} className="h-9 border-b border-border/20 px-3 flex items-center">
                <span className="text-[12px] truncate font-medium text-amber-600" title={m.title}>
                  <Diamond className="size-3 inline mr-1" />
                  {m.title}
                </span>
              </div>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth, minWidth: '100%' }} className="relative">
              <div className="h-10 border-b border-border/40 relative bg-muted/10">
                {headerDates.map((d, i) => (
                  <div key={i} className="absolute top-0 h-full flex items-center justify-center text-[10px] text-muted-foreground border-r border-border/20" style={{ left: d.left, width: d.width }}>
                    {d.label}
                  </div>
                ))}
              </div>

              {todayLeft > 0 && todayLeft < totalWidth && (
                <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: todayLeft }}>
                  <div className="absolute -top-0 -left-[12px] text-[9px] bg-red-500 text-white px-1 rounded-b">Today</div>
                </div>
              )}

              {tasks.map((t) => {
                const left = getPosition(t.start_date || t.due_date)
                const width = getBarWidth(t.start_date, t.due_date)
                return (
                  <div key={t.id} className="h-9 border-b border-border/10 relative">
                    <div
                      className={`absolute top-1.5 h-6 rounded-md flex items-center px-2 text-[10px] text-white font-medium truncate shadow-sm ${t.is_critical ? 'bg-red-500' : 'bg-primary'}`}
                      style={{ left, width: Math.max(width, 20) }}
                      title={`${t.title} (${t.progress ?? 0}%)`}
                    >
                      {width > 60 && t.title}
                      <div className="absolute inset-0 rounded-md bg-white/20" style={{ width: `${100 - (t.progress ?? 0)}%`, right: 0, left: 'auto' }} />
                    </div>
                  </div>
                )
              })}

              {milestones.map((m) => {
                const left = getPosition(m.due_date)
                return (
                  <div key={m.id} className="h-9 border-b border-border/10 relative">
                    <div className="absolute top-2 size-5 rotate-45 bg-amber-500 border-2 border-amber-600 shadow-sm" style={{ left: left - 10 }} title={m.title} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Empty State ────────────────────────────────────────────────────── */

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-[14px] font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground/60">{description}</p>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────────────── */

export default function GanttPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`)
      setProject(data)
    } catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params: { page_size: 200 } })
      setTasks(normalizePaginated<Task>(data).items)
    } catch { toast.error('Failed to load tasks') }
  }, [projectId])

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, { params: { page_size: 100 } })
      setMilestones(normalizePaginated<Milestone>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchTasks(); fetchMilestones() }, [fetchProject, fetchTasks, fetchMilestones])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gantt Chart"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        {tasks.length === 0 ? (
          <EmptyState icon={GanttChartIcon} title="No tasks to display" description="Add tasks with start and due dates to see the Gantt chart." />
        ) : (
          <GanttChart
            tasks={tasks}
            milestones={milestones}
            projectStart={project?.start_date ?? ''}
            projectEnd={project?.end_date ?? ''}
          />
        )}
      </div>
    </div>
  )
}
