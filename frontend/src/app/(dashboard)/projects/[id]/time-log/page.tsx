'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Plus, Timer, Play, Square, CheckCircle2, Minus } from 'lucide-react'

interface Task { id: string; title: string }

interface TimeLog {
  id: string; task_id: string; task_title: string; user_name: string; user_id: string
  hours: number; description: string; logged_at: string; log_date: string; start_time: string; end_time: string; billable: boolean; is_billable: boolean
}

interface Project { id: string; name: string }

export default function TimeLogPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerTaskId, setTimerTaskId] = useState('')
  const [timerDescription, setTimerDescription] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Manual log state
  const [showTimeLogForm, setShowTimeLogForm] = useState(false)
  const [manualLogHours, setManualLogHours] = useState('')
  const [manualLogTask, setManualLogTask] = useState('')
  const [manualLogDesc, setManualLogDesc] = useState('')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params: { page_size: 200 } })
      setTasks(normalizePaginated<Task>(data).items)
    } catch {}
  }, [projectId])

  const fetchTimeLogs = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/time-logs`, { params: { page_size: 100 } })
      setTimeLogs(normalizePaginated<TimeLog>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchTasks(); fetchTimeLogs() }, [fetchProject, fetchTasks, fetchTimeLogs])

  const startTimer = (taskId: string) => {
    setTimerTaskId(taskId); setTimerSeconds(0); setTimerRunning(true)
    timerRef.current = setInterval(() => { setTimerSeconds((s) => s + 1) }, 1000)
  }

  const stopTimer = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerRunning(false)
    const hours = +(timerSeconds / 3600).toFixed(2)
    if (hours > 0) {
      try {
        await api.post(`/projects/${projectId}/time-logs`, { task_id: parseInt(timerTaskId), hours, description: timerDescription || 'Timer entry', log_date: new Date().toISOString().split('T')[0] })
        toast.success(`Logged ${hours}h`); fetchTimeLogs()
      } catch { toast.error('Failed to log time') }
    }
    setTimerTaskId(''); setTimerDescription(''); setTimerSeconds(0)
  }

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleManualTimeLog = async () => {
    if (!manualLogHours || !manualLogTask) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/time-logs`, { task_id: parseInt(manualLogTask), hours: parseFloat(manualLogHours), description: manualLogDesc, log_date: new Date().toISOString().split('T')[0] })
      toast.success('Time logged'); setShowTimeLogForm(false); setManualLogHours(''); setManualLogTask(''); setManualLogDesc(''); fetchTimeLogs()
    } catch { toast.error('Failed to log time') } finally { setSubmitting(false) }
  }

  const totalHoursLogged = timeLogs.reduce((sum, l) => sum + l.hours, 0)

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Time Log"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        {/* Timer bar */}
        <div className="flex items-center gap-4 mb-4 p-4 rounded-lg border border-border/40 bg-muted/10">
          {timerRunning ? (
            <>
              <div className="flex items-center gap-2 text-[14px] font-mono font-semibold tabular-nums text-primary">
                <Timer className="size-4 animate-pulse" />{formatTimer(timerSeconds)}
              </div>
              <Input placeholder="What are you working on?" value={timerDescription} onChange={(e) => setTimerDescription(e.target.value)} className="flex-1 h-8 text-[12px]" />
              <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={stopTimer}><Square className="size-3" />Stop</Button>
            </>
          ) : (
            <>
              <Select value={timerTaskId} onValueChange={setTimerTaskId}>
                <SelectTrigger className="w-[250px] h-8 text-[12px]"><SelectValue placeholder="Select task..." /></SelectTrigger>
                <SelectContent>{tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => timerTaskId && startTimer(timerTaskId)} disabled={!timerTaskId}>
                <Play className="size-3" />Start Timer
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] ml-auto" onClick={() => setShowTimeLogForm(true)}>
                <Plus className="size-3" />Manual Entry
              </Button>
            </>
          )}
        </div>

        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Team Member</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hours</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Billable</th>
              </tr>
            </thead>
            <tbody>
              {timeLogs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-16 text-muted-foreground text-[13px]">No time logs recorded yet.</td></tr>
              )}
              {timeLogs.map((l) => (
                <tr key={l.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5 font-medium">{l.task_title}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{l.user_name}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{l.description ?? '---'}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold">{l.hours}h</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{(l.logged_at || l.log_date) ? format(new Date(l.logged_at || l.log_date), 'MMM d, yyyy') : '---'}</td>
                  <td className="px-4 py-3.5 text-center">
                    {(l.billable || l.is_billable) ? <CheckCircle2 className="size-4 text-green-500 mx-auto" /> : <Minus className="size-4 text-muted-foreground/40 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {timeLogs.length > 0 && (
          <div className="mt-3 flex items-center gap-6 text-[12px] text-muted-foreground">
            <span>Total: <strong className="text-foreground">{totalHoursLogged.toFixed(1)}h</strong></span>
            <span>Billable: <strong className="text-foreground">{timeLogs.filter((l) => l.billable || l.is_billable).reduce((s, l) => s + l.hours, 0).toFixed(1)}h</strong></span>
          </div>
        )}

        <Dialog open={showTimeLogForm} onOpenChange={setShowTimeLogForm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-[15px]">Log Time Manually</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div>
                <Label className="text-[12px]">Task</Label>
                <Select value={manualLogTask} onValueChange={setManualLogTask}>
                  <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue placeholder="Select task..." /></SelectTrigger>
                  <SelectContent>{tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]">Hours</Label>
                <Input type="number" step="0.25" min="0" value={manualLogHours} onChange={(e) => setManualLogHours(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="e.g. 2.5" />
              </div>
              <div>
                <Label className="text-[12px]">Description</Label>
                <Textarea value={manualLogDesc} onChange={(e) => setManualLogDesc(e.target.value)} className="mt-1 text-[13px]" placeholder="What did you work on?" rows={3} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
              <Button size="sm" className="h-9 text-[13px]" onClick={handleManualTimeLog} disabled={submitting}>
                {submitting ? 'Logging...' : 'Log Time'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
