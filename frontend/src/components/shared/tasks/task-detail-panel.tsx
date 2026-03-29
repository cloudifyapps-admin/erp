'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
} from '@/components/ui/sheet'
import {
  Plus, Loader2, Play, Square, Clock, MessageSquare, CheckSquare,
  Paperclip, Send, Trash2, FileText, X, Calendar, Flag,
  CircleDot, User2, Timer, TrendingUp, Edit3, ExternalLink,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task, TaskComment, ChecklistItem, TaskAttachment, ProjectMember, PanelTab } from './types'
import { PRIORITY_COLORS, STATUS_OPTIONS, PRIORITY_OPTIONS, formatElapsed, formatFileSize, timeAgo } from './types'

/* ── Helpers ───────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function TabButton({ active, icon: Icon, label, count, onClick }: {
  active: boolean; icon: typeof MessageSquare; label: string; count?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="size-3.5" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn(
          'ml-0.5 inline-flex items-center justify-center size-4 rounded-full text-[9px] font-bold',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          {count}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  )
}

/* ── Property Row ──────────────────────────────────────────────────── */

function PropertyRow({ icon: Icon, label, children }: {
  icon: typeof Calendar; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className="flex items-center gap-2 w-[120px] shrink-0">
        <Icon className="size-3.5 text-muted-foreground/60" />
        <span className="text-[12px] text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}

/* ── TaskDetailPanel ─────────────────────────────────────────────── */

interface TaskDetailPanelProps {
  task: Task | null
  open: boolean
  onClose: () => void
  projectId: string
  onUpdate: () => void
  /** Show project name link in header (for global task list) */
  showProject?: boolean
  /** Project members for assignee dropdown */
  members?: ProjectMember[]
}

export function TaskDetailPanel({ task, open, onClose, projectId, onUpdate, showProject, members = [] }: TaskDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('details')

  // Editable fields
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [progress, setProgress] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerLogId, setTimerLogId] = useState<number | null>(null)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [startingTimer, setStartingTimer] = useState(false)
  const [stoppingTimer, setStoppingTimer] = useState(false)

  // Comments state
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [addingCheckItem, setAddingCheckItem] = useState(false)

  // Attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  // Resolve the actual projectId (task may carry its own project_id for global views)
  const resolvedProjectId = task?.project_id ? String(task.project_id) : projectId

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? '')
      setDescription(task.description ?? '')
      setStatus(task.status)
      setPriority(task.priority)
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '')
      setEstimatedHours(task.estimated_hours ? String(task.estimated_hours) : '')
      setProgress(task.progress != null ? String(task.progress) : '0')
      setAssignedTo(task.assigned_to ? String(task.assigned_to) : '')
      setTimerRunning(false)
      setTimerLogId(null)
      setTimerStart(null)
      setElapsed(0)
      setActiveTab('details')
      setComments([])
      setChecklist([])
      setAttachments([])
      setDirty(false)
      setIsEditingTitle(false)
      setIsEditingDesc(false)
    }
  }, [task])

  // Timer tick
  useEffect(() => {
    if (!timerRunning || !timerStart) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, timerStart])

  // Fetch tab data
  useEffect(() => {
    if (!task || !open) return
    if (activeTab === 'comments') fetchComments()
    if (activeTab === 'checklist') fetchChecklist()
    if (activeTab === 'attachments') fetchAttachments()
  }, [activeTab, task, open])

  const markDirty = () => { if (!dirty) setDirty(true) }

  const fetchComments = async () => {
    if (!task) return
    setCommentsLoading(true)
    try {
      const { data } = await api.get(`/projects/${resolvedProjectId}/tasks/${task.id}/comments`, { params: { page_size: 100 } })
      setComments(normalizePaginated<TaskComment>(data).items)
    } catch { setComments([]) } finally { setCommentsLoading(false) }
  }

  const fetchChecklist = async () => {
    if (!task) return
    setChecklistLoading(true)
    try {
      const { data } = await api.get(`/projects/${resolvedProjectId}/tasks/${task.id}/checklists`, { params: { page_size: 100 } })
      const items = normalizePaginated<ChecklistItem>(data).items
      setChecklist(items.sort((a, b) => a.sort_order - b.sort_order))
    } catch { setChecklist([]) } finally { setChecklistLoading(false) }
  }

  const fetchAttachments = async () => {
    if (!task) return
    setAttachmentsLoading(true)
    try {
      const { data } = await api.get(`/projects/${resolvedProjectId}/tasks/${task.id}/attachments`, { params: { page_size: 100 } })
      setAttachments(normalizePaginated<TaskAttachment>(data).items)
    } catch { setAttachments([]) } finally { setAttachmentsLoading(false) }
  }

  const handleStartTimer = async () => {
    if (!task) return
    setStartingTimer(true)
    try {
      const { data } = await api.post(`/projects/${resolvedProjectId}/time-logs/start`, { task_id: parseInt(task.id) })
      setTimerLogId(data.id)
      setTimerStart(new Date())
      setTimerRunning(true)
      setElapsed(0)
      toast.success('Timer started')
    } catch { toast.error('Failed to start timer') } finally { setStartingTimer(false) }
  }

  const handleStopTimer = async () => {
    if (!timerLogId) return
    setStoppingTimer(true)
    try {
      const { data } = await api.post(`/projects/${resolvedProjectId}/time-logs/${timerLogId}/stop`)
      setTimerRunning(false)
      setTimerLogId(null)
      setTimerStart(null)
      const hrs = data.hours ?? (elapsed / 3600)
      toast.success(`Timer stopped — ${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m logged`)
      onUpdate()
    } catch { toast.error('Failed to stop timer') } finally { setStoppingTimer(false) }
  }

  const handleSave = async () => {
    if (!task) return
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await api.patch(`/projects/${resolvedProjectId}/tasks/${task.id}`, {
        title, description: description || null, status, priority,
        due_date: dueDate || null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        progress: progress ? parseInt(progress) : 0,
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
      })
      toast.success('Task updated')
      setDirty(false)
      onUpdate()
    } catch { toast.error('Failed to update task') } finally { setSaving(false) }
  }

  const handlePostComment = async () => {
    if (!task || !newComment.trim()) return
    setPostingComment(true)
    try {
      await api.post(`/projects/${resolvedProjectId}/tasks/${task.id}/comments`, { body: newComment })
      setNewComment('')
      toast.success('Comment posted')
      fetchComments()
    } catch { toast.error('Failed to post comment') } finally { setPostingComment(false) }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!task) return
    try {
      await api.delete(`/projects/${resolvedProjectId}/tasks/${task.id}/comments/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
      toast.success('Comment deleted')
    } catch { toast.error('Failed to delete comment') }
  }

  const handleAddCheckItem = async () => {
    if (!task || !newCheckItem.trim()) return
    setAddingCheckItem(true)
    try {
      await api.post(`/projects/${resolvedProjectId}/tasks/${task.id}/checklists`, {
        title: newCheckItem, sort_order: checklist.length,
      })
      setNewCheckItem('')
      fetchChecklist()
    } catch { toast.error('Failed to add item') } finally { setAddingCheckItem(false) }
  }

  const handleToggleCheckItem = async (item: ChecklistItem) => {
    if (!task) return
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, is_completed: !c.is_completed } : c))
    try {
      await api.patch(`/projects/${resolvedProjectId}/tasks/${task.id}/checklists/${item.id}`, {
        is_completed: !item.is_completed,
      })
    } catch {
      setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, is_completed: item.is_completed } : c))
      toast.error('Failed to update')
    }
  }

  const handleDeleteCheckItem = async (itemId: number) => {
    if (!task) return
    try {
      await api.delete(`/projects/${resolvedProjectId}/tasks/${task.id}/checklists/${itemId}`)
      setChecklist(prev => prev.filter(c => c.id !== itemId))
    } catch { toast.error('Failed to delete') }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files?.length) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', e.target.files[0])
    try {
      await api.post(`/projects/${resolvedProjectId}/tasks/${task.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('File uploaded')
      fetchAttachments()
    } catch { toast.error('Failed to upload file') } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (id: number) => {
    if (!task) return
    try {
      await api.delete(`/projects/${resolvedProjectId}/tasks/${task.id}/attachments/${id}`)
      setAttachments(prev => prev.filter(a => a.id !== id))
      toast.success('Attachment deleted')
    } catch { toast.error('Failed to delete') }
  }

  if (!task) return null

  const completedChecks = checklist.filter(c => c.is_completed).length
  const checklistProgress = checklist.length > 0 ? Math.round((completedChecks / checklist.length) * 100) : 0
  const progressVal = Math.min(100, parseInt(progress) || 0)
  const assigneeName = (() => {
    if (assignedTo && members.length > 0) {
      const m = members.find(m => String(m.user_id) === assignedTo)
      if (m?.user_name) return m.user_name
    }
    return task.assignee_name || null
  })()

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-[480px] p-0 flex flex-col overflow-hidden gap-0">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-0 space-y-3">
          <SheetHeader className="space-y-0">
            <SheetDescription className="sr-only">Task details and management</SheetDescription>

            {/* Project link + ID */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
              {showProject && task.project_name ? (
                <Link href={`/projects/${task.project_id}`} className="text-primary hover:underline font-medium flex items-center gap-1">
                  {task.project_name}
                  <ExternalLink className="size-2.5" />
                </Link>
              ) : null}
              {task.wbs_code && (
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{task.wbs_code}</span>
              )}
            </div>

            {/* Title */}
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={title}
                onChange={(e) => { setTitle(e.target.value); markDirty() }}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTitle(false); if (e.key === 'Escape') { setTitle(task.title); setIsEditingTitle(false) } }}
                className="text-[16px] font-semibold h-auto py-1 px-2 -ml-2 border-primary/30"
                autoFocus
              />
            ) : (
              <SheetTitle
                className="text-[16px] font-semibold leading-snug cursor-pointer hover:text-primary/80 transition-colors flex items-center gap-1.5 group"
                onClick={() => { setIsEditingTitle(true); setTimeout(() => titleInputRef.current?.focus(), 0) }}
              >
                <span className="flex-1">{title || task.title}</span>
                <Edit3 className="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              </SheetTitle>
            )}
          </SheetHeader>

          {/* Status + Priority badges */}
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_COLORS[status] ?? STATUS_COLORS.todo)}>
              {STATUS_LABELS[status] ?? status}
            </span>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low)}>
              {priority}
            </span>
            {task.is_critical && (
              <Badge variant="destructive" className="text-[10px] h-4">Critical Path</Badge>
            )}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <Timer className="size-4 text-muted-foreground/60" />
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground font-medium">Time Tracked</span>
              <span className="text-[13px] font-semibold tabular-nums">{task.actual_hours ?? 0}h logged</span>
            </div>
            {timerRunning && (
              <span className="text-[14px] font-mono font-bold text-primary tabular-nums animate-pulse ml-auto mr-2">
                {formatElapsed(elapsed)}
              </span>
            )}
            <div className="ml-auto">
              {!timerRunning ? (
                <Button size="sm" className="h-7 gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-full" onClick={handleStartTimer} disabled={startingTimer}>
                  {startingTimer ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                  Start
                </Button>
              ) : (
                <Button size="sm" variant="destructive" className="h-7 gap-1 text-[11px] px-3 rounded-full" onClick={handleStopTimer} disabled={stoppingTimer}>
                  {stoppingTimer ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />}
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center border-b border-border/40 -mx-5 px-5">
            <TabButton active={activeTab === 'details'} icon={FileText} label="Details" onClick={() => setActiveTab('details')} />
            <TabButton active={activeTab === 'comments'} icon={MessageSquare} label="Comments" count={comments.length} onClick={() => setActiveTab('comments')} />
            <TabButton active={activeTab === 'checklist'} icon={CheckSquare} label="Checklist" count={checklist.length} onClick={() => setActiveTab('checklist')} />
            <TabButton active={activeTab === 'attachments'} icon={Paperclip} label="Files" count={attachments.length} onClick={() => setActiveTab('attachments')} />
          </div>
        </div>

        {/* ── Tab Content ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Details Tab ── */}
          {activeTab === 'details' && (
            <div className="px-5 py-4 space-y-1">

              {/* Description */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-medium text-muted-foreground">Description</span>
                  {!isEditingDesc && (
                    <button className="text-[11px] text-primary hover:underline" onClick={() => setIsEditingDesc(true)}>
                      {description ? 'Edit' : 'Add'}
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <Textarea
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); markDirty() }}
                      className="text-[13px] resize-none min-h-[80px]"
                      placeholder="Add a description..."
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setDescription(task.description ?? ''); setIsEditingDesc(false) }}>
                        Cancel
                      </Button>
                      <Button size="sm" className="h-7 text-[11px]" onClick={() => setIsEditingDesc(false)}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : description ? (
                  <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed bg-muted/20 rounded-lg px-3 py-2.5 border border-border/20 cursor-pointer hover:border-border/40 transition-colors" onClick={() => setIsEditingDesc(true)}>
                    {description}
                  </p>
                ) : (
                  <p className="text-[12px] text-muted-foreground/50 italic cursor-pointer hover:text-muted-foreground transition-colors" onClick={() => setIsEditingDesc(true)}>
                    No description added
                  </p>
                )}
              </div>

              {/* Properties */}
              <div className="divide-y divide-border/20">
                {/* Status */}
                <PropertyRow icon={CircleDot} label="Status">
                  <Select value={status} onValueChange={(v) => { setStatus(v); markDirty() }}>
                    <SelectTrigger className="h-8 text-[12px] w-[140px] border-transparent bg-transparent hover:bg-muted/50 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>

                {/* Priority */}
                <PropertyRow icon={Flag} label="Priority">
                  <Select value={priority} onValueChange={(v) => { setPriority(v); markDirty() }}>
                    <SelectTrigger className="h-8 text-[12px] w-[140px] border-transparent bg-transparent hover:bg-muted/50 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>

                {/* Assignee */}
                <PropertyRow icon={User2} label="Assignee">
                  {members.length > 0 ? (
                    <Select value={assignedTo || 'unassigned'} onValueChange={(v) => { setAssignedTo(v === 'unassigned' ? '' : v); markDirty() }}>
                      <SelectTrigger className="h-8 text-[12px] border-transparent bg-transparent hover:bg-muted/50 transition-colors w-[180px]">
                        <div className="flex items-center gap-2">
                          {assigneeName ? (
                            <>
                              <Avatar size="sm">
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                  {getInitials(assigneeName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{assigneeName}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {members.map((m) => (
                          <SelectItem key={String(m.user_id)} value={String(m.user_id)}>
                            <div className="flex items-center gap-2">
                              <Avatar size="sm">
                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                                  {getInitials(m.user_name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                              {m.user_name || `User ${m.user_id}`}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 h-8 text-[12px]">
                      {assigneeName ? (
                        <>
                          <Avatar size="sm">
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                              {getInitials(assigneeName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{assigneeName}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  )}
                </PropertyRow>

                {/* Due Date */}
                <PropertyRow icon={Calendar} label="Due Date">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); markDirty() }}
                    className="h-8 text-[12px] w-[160px] border-transparent bg-transparent hover:bg-muted/50 transition-colors"
                  />
                </PropertyRow>

                {/* Estimated Hours */}
                <PropertyRow icon={Clock} label="Est. Hours">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={estimatedHours}
                    onChange={(e) => { setEstimatedHours(e.target.value); markDirty() }}
                    placeholder="--"
                    className="h-8 text-[12px] w-[100px] border-transparent bg-transparent hover:bg-muted/50 transition-colors"
                  />
                </PropertyRow>

                {/* Actual Hours */}
                <PropertyRow icon={Timer} label="Actual Hours">
                  <span className="text-[12px] font-medium tabular-nums h-8 flex items-center">{task.actual_hours ?? 0}h</span>
                </PropertyRow>

                {/* Progress */}
                <PropertyRow icon={TrendingUp} label="Progress">
                  <div className="flex items-center gap-2.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={(e) => { setProgress(e.target.value); markDirty() }}
                      className="h-8 text-[12px] w-[60px] border-transparent bg-transparent hover:bg-muted/50 transition-colors tabular-nums"
                    />
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          progressVal === 100 ? 'bg-emerald-500' : progressVal >= 50 ? 'bg-primary' : 'bg-amber-500'
                        )}
                        style={{ width: `${progressVal}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{progressVal}%</span>
                  </div>
                </PropertyRow>
              </div>

              {/* Dates info */}
              {(task.created_at || task.start_date) && (
                <div className="mt-3 pt-3 border-t border-border/20 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground/70">
                  {task.created_at && <span>Created {timeAgo(task.created_at)}</span>}
                  {task.start_date && <span>Started {new Date(task.start_date).toLocaleDateString()}</span>}
                  {task.completed_at && <span>Completed {timeAgo(task.completed_at)}</span>}
                </div>
              )}

              {/* Save Button */}
              {dirty && (
                <div className="pt-4">
                  <Button onClick={handleSave} disabled={saving} className="w-full h-9 text-[13px] rounded-lg font-semibold">
                    {saving ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Saving...</> : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Comments Tab ── */}
          {activeTab === 'comments' && (
            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Comment input */}
              <div className="rounded-lg border border-border/40 focus-within:border-primary/40 transition-colors overflow-hidden">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="text-[13px] resize-none border-0 focus-visible:ring-0 min-h-[60px] rounded-b-none"
                  rows={2}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostComment() }}
                />
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border/20">
                  <span className="text-[10px] text-muted-foreground/60">Ctrl+Enter to post</span>
                  <Button size="sm" className="h-7 gap-1.5 text-[11px] rounded-full px-3" onClick={handlePostComment} disabled={postingComment || !newComment.trim()}>
                    {postingComment ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                    Post
                  </Button>
                </div>
              </div>

              {commentsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center">
                    <MessageSquare className="size-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">No comments yet</p>
                  <p className="text-[11px] text-muted-foreground/60">Be the first to comment on this task</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="group relative">
                      <div className="flex gap-3">
                        <Avatar size="sm" className="mt-0.5 shrink-0">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                            {getInitials(c.user_name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px] font-semibold">{c.user_name || 'User'}</span>
                            <span className="text-[10px] text-muted-foreground/60">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" onClick={() => handleDeleteComment(c.id)}>
                          <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Checklist Tab ── */}
          {activeTab === 'checklist' && (
            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Progress bar */}
              {checklist.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-300', checklistProgress === 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${checklistProgress}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums font-medium">{completedChecks}/{checklist.length}</span>
                </div>
              )}

              {/* Add item */}
              <div className="flex items-center gap-2">
                <Input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder="Add checklist item..."
                  className="h-8 text-[12px] flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCheckItem() }}
                />
                <Button size="sm" className="h-8 px-3 text-[11px] rounded-full" onClick={handleAddCheckItem} disabled={addingCheckItem || !newCheckItem.trim()}>
                  {addingCheckItem ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                </Button>
              </div>

              {checklistLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : checklist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center">
                    <CheckSquare className="size-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">No checklist items</p>
                  <p className="text-[11px] text-muted-foreground/60">Break this task into smaller steps</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {checklist.map((item) => (
                    <div key={item.id} className="group flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors -mx-2">
                      <Checkbox checked={item.is_completed} onCheckedChange={() => handleToggleCheckItem(item)} className="size-4" />
                      <span className={cn('text-[13px] flex-1', item.is_completed && 'line-through text-muted-foreground/60')}>{item.title}</span>
                      <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteCheckItem(item.id)}>
                        <X className="size-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Attachments Tab ── */}
          {activeTab === 'attachments' && (
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
                <Button variant="outline" size="sm" className="h-10 gap-2 text-[12px] w-full border-dashed rounded-lg hover:bg-muted/40 transition-colors" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {uploading ? 'Uploading...' : 'Upload File'}
                </Button>
              </div>

              {attachmentsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : attachments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center">
                    <Paperclip className="size-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground">No attachments</p>
                  <p className="text-[11px] text-muted-foreground/60">Upload files related to this task</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="group flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:border-border/50 bg-card hover:bg-muted/20 transition-all">
                      <div className="size-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                        <FileText className="size-4 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{att.file_name}</p>
                        <p className="text-[11px] text-muted-foreground/70">{formatFileSize(att.file_size)} &middot; {timeAgo(att.created_at)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteAttachment(att.id)}>
                        <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
