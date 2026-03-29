'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TaskKanbanBoard,
  TaskFilterBar,
  TaskDetailPanel,
  type Task,
  type Milestone,
  type ProjectMember,
} from '@/components/shared/tasks'

interface Project {
  id: string
  name: string
}

export default function KanbanPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterMilestone, setFilterMilestone] = useState('all')

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`)
      setProject(data)
    } catch {
      toast.error('Failed to load project')
    }
  }, [projectId])

  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page_size: 200 }
      if (filterPriority !== 'all') params.priority = filterPriority
      if (filterAssignee !== 'all') params.assigned_to = filterAssignee
      if (filterMilestone !== 'all') params.milestone_id = filterMilestone
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params })
      setTasks(normalizePaginated<Task>(data).items)
    } catch {
      toast.error('Failed to load tasks')
    }
  }, [projectId, filterPriority, filterAssignee, filterMilestone])

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, { params: { page_size: 100 } })
      setMilestones(normalizePaginated<Milestone>(data).items)
    } catch { /* optional */ }
  }, [projectId])

  const fetchMembers = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/members`, { params: { page_size: 100 } })
      const items = Array.isArray(data) ? data : (data.items || data.results || [])
      setMembers(items)
    } catch { /* optional */ }
  }, [projectId])

  useEffect(() => {
    Promise.all([fetchProject(), fetchMilestones(), fetchMembers()]).finally(() => setLoading(false))
  }, [fetchProject, fetchMilestones, fetchMembers])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Client-side search filter
  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks
    const q = search.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignee_name?.toLowerCase().includes(q)
    )
  }, [tasks, search])

  const activeFilterCount = [
    filterPriority !== 'all' ? 1 : 0,
    filterAssignee !== 'all' ? 1 : 0,
    filterMilestone !== 'all' ? 1 : 0,
    search.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const handleDrop = async (taskId: string, newStatus: string) => {
    const prevTasks = tasks
    setTasks((ts) => ts.map((t) => (String(t.id) === String(taskId) ? { ...t, status: newStatus } : t)))
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}/status`, { status: newStatus })
    } catch {
      setTasks(prevTasks)
      toast.error('Failed to update task')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setFilterPriority('all')
    setFilterAssignee('all')
    setFilterMilestone('all')
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-theme(spacing.16))]">
      <PageHeader
        title="Kanban Board"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            {activeFilterCount > 0 && filteredTasks.length !== tasks.length ? (
              <span>{filteredTasks.length} of {tasks.length} tasks</span>
            ) : (
              <span>{tasks.length} tasks</span>
            )}
          </div>
        }
      />

      <TaskFilterBar
        search={search}
        onSearchChange={setSearch}
        priority={filterPriority}
        onPriorityChange={setFilterPriority}
        assignee={filterAssignee}
        onAssigneeChange={setFilterAssignee}
        milestoneId={filterMilestone}
        onMilestoneChange={setFilterMilestone}
        milestones={milestones}
        members={members}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <TaskKanbanBoard
        tasks={filteredTasks}
        onDrop={handleDrop}
        onTaskClick={(t) => { setSelectedTask(t); setTaskPanelOpen(true) }}
      />

      <TaskDetailPanel
        task={selectedTask}
        open={taskPanelOpen}
        onClose={() => { setTaskPanelOpen(false); setSelectedTask(null) }}
        projectId={projectId}
        onUpdate={fetchTasks}
        members={members}
      />
    </div>
  )
}
