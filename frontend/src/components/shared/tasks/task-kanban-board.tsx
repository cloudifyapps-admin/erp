'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Clock, CheckCircle2, AlertCircle, Circle,
  Calendar, User2, GripVertical,
} from 'lucide-react'
import type { Task } from './types'
import { PRIORITY_COLORS } from './types'

/* ── Kanban Column Config ──────────────────────────────────────────── */

const KANBAN_COLUMNS: {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  bg: string
  headerBorder: string
}[] = [
  { key: 'todo', label: 'To Do', icon: <Circle className="size-4" />, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/30', headerBorder: 'border-b-slate-300 dark:border-b-slate-700' },
  { key: 'in_progress', label: 'In Progress', icon: <Clock className="size-4" />, color: 'text-blue-600', bg: 'bg-blue-50/60 dark:bg-blue-900/20', headerBorder: 'border-b-blue-300 dark:border-b-blue-700' },
  { key: 'review', label: 'Review', icon: <AlertCircle className="size-4" />, color: 'text-orange-600', bg: 'bg-orange-50/60 dark:bg-orange-900/20', headerBorder: 'border-b-orange-300 dark:border-b-orange-700' },
  { key: 'done', label: 'Done', icon: <CheckCircle2 className="size-4" />, color: 'text-green-600', bg: 'bg-green-50/60 dark:bg-green-900/20', headerBorder: 'border-b-green-300 dark:border-b-green-700' },
]

export { KANBAN_COLUMNS }

/* ── Kanban Card ────────────────────────────────────────────────────── */

function KanbanCard({ task, onClick, showProject }: { task: Task; onClick: (t: Task) => void; showProject?: boolean }) {
  const [dragging, setDragging] = useState(false)
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', String(task.id))
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onClick(task)}
      className={`group rounded-lg border border-border/60 bg-card p-3.5 shadow-xs cursor-grab active:cursor-grabbing transition-all ${
        dragging ? 'opacity-40 scale-95' : 'opacity-100'
      } hover:shadow-sm hover:border-border`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug">{task.title}</p>
        <GripVertical className="size-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
      </div>
      {showProject && task.project_name && (
        <p className="mt-1 text-[11px] text-primary truncate">{task.project_name}</p>
      )}
      {task.description && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">{task.description}</p>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {task.priority && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
            {task.priority}
          </span>
        )}
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            <Calendar className="size-2.5" />
            {format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        {(task.progress ?? 0) > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">{task.progress}%</span>
        )}
        {task.assignee_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <User2 className="size-2.5" />
            {task.assignee_name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Kanban Column ──────────────────────────────────────────────────── */

function KanbanColumn({ column, tasks, onDrop, onTaskClick, showProject }: {
  column: (typeof KANBAN_COLUMNS)[0]
  tasks: Task[]
  onDrop: (taskId: string, status: string) => void
  onTaskClick: (t: Task) => void
  showProject?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={`flex flex-col min-w-[280px] flex-1 rounded-xl border border-border/40 ${column.bg} transition-all ${
        dragOver ? 'ring-2 ring-primary/20 border-primary/30' : ''
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const taskId = e.dataTransfer.getData('taskId')
        if (taskId) onDrop(taskId, column.key)
      }}
    >
      <div className={`flex items-center gap-2 px-4 py-3 border-b-2 ${column.headerBorder} ${column.color}`}>
        {column.icon}
        <span className="text-[13px] font-semibold">{column.label}</span>
        <span className="ml-auto text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 border border-border/50 font-medium">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-3 flex-1 min-h-0 overflow-y-auto">
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} onClick={onTaskClick} showProject={showProject} />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[12px] text-muted-foreground/50">No tasks</div>
        )}
      </div>
    </div>
  )
}

/* ── TaskKanbanBoard ────────────────────────────────────────────────── */

interface TaskKanbanBoardProps {
  tasks: Task[]
  onDrop: (taskId: string, newStatus: string) => void
  onTaskClick: (task: Task) => void
  /** Show project name on cards (for global task list) */
  showProject?: boolean
}

export function TaskKanbanBoard({ tasks, onDrop, onTaskClick, showProject }: TaskKanbanBoardProps) {
  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.key] = tasks.filter((t) => t.status === col.key)
      return acc
    },
    {} as Record<string, Task[]>
  )

  return (
    <div className="flex-1 rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-4 flex flex-col min-h-0">
      <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-2">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            column={col}
            tasks={tasksByStatus[col.key] ?? []}
            onDrop={onDrop}
            onTaskClick={onTaskClick}
            showProject={showProject}
          />
        ))}
      </div>
    </div>
  )
}
