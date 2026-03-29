'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Plus, Layers, ChevronLeft, ChevronRight } from 'lucide-react'

interface Phase {
  id: string; name: string; description: string; status: string; order: number
  start_date: string; end_date: string; progress: number; color: string
}

interface Project { id: string; name: string }

function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {count !== undefined && <Badge variant="secondary" className="text-[11px] h-5 px-1.5">{count}</Badge>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-[14px] font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground/60">{description}</p>
    </div>
  )
}

export default function PhasesPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAddPhase, setShowAddPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseStart, setNewPhaseStart] = useState('')
  const [newPhaseEnd, setNewPhaseEnd] = useState('')
  const [newPhaseStatus, setNewPhaseStatus] = useState('pending')
  const [newPhaseColor, setNewPhaseColor] = useState('#6366f1')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchPhases = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/phases`, { params: { page_size: 50 } })
      setPhases(normalizePaginated<Phase>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchPhases() }, [fetchProject, fetchPhases])

  const handlePhaseReorder = async (phaseId: string, direction: 'up' | 'down') => {
    const idx = phases.findIndex((p) => p.id === phaseId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= phases.length) return
    const newPhases = [...phases]
    ;[newPhases[idx], newPhases[swapIdx]] = [newPhases[swapIdx], newPhases[idx]]
    setPhases(newPhases)
    try {
      await api.patch(`/projects/${projectId}/phases/${phaseId}`, { order: swapIdx })
    } catch {
      setPhases(phases)
      toast.error('Failed to reorder phase')
    }
  }

  const handleAddPhase = async () => {
    if (!newPhaseName.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/phases`, {
        name: newPhaseName,
        start_date: newPhaseStart || null,
        end_date: newPhaseEnd || null,
        status: newPhaseStatus,
        color: newPhaseColor,
        sort_order: phases.length,
      })
      toast.success('Phase created')
      setShowAddPhase(false)
      setNewPhaseName(''); setNewPhaseStart(''); setNewPhaseEnd(''); setNewPhaseStatus('pending'); setNewPhaseColor('#6366f1')
      fetchPhases()
    } catch { toast.error('Failed to create phase') } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Phases"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddPhase(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Phase
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Project Phases" count={phases.length} />
        <div className="flex flex-col gap-3 max-w-3xl">
          {phases.length === 0 && (
            <EmptyState icon={Layers} title="No phases defined" description="Break your project into phases for better tracking." />
          )}
          {phases.map((phase, idx) => (
            <div key={phase.id} className="flex items-center gap-3 rounded-lg border border-border/40 p-4 hover:bg-muted/10 transition-colors">
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={idx === 0} onClick={() => handlePhaseReorder(phase.id, 'up')}>
                  <ChevronLeft className="size-3 rotate-90" />
                </Button>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={idx === phases.length - 1} onClick={() => handlePhaseReorder(phase.id, 'down')}>
                  <ChevronRight className="size-3 rotate-90" />
                </Button>
              </div>
              <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: phase.color || '#6366f1' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold">{phase.name}</span>
                  <StatusBadge status={phase.status} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3">
                  <span>{phase.start_date ? format(new Date(phase.start_date), 'MMM d') : '---'} - {phase.end_date ? format(new Date(phase.end_date), 'MMM d, yyyy') : '---'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 w-32">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${phase.progress ?? 0}%` }} />
                </div>
                <span className="text-[12px] text-muted-foreground tabular-nums w-9 text-right font-medium">{phase.progress ?? 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAddPhase} onOpenChange={setShowAddPhase}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Add Phase</DialogTitle>
            <DialogDescription>Add a new phase to this project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-[12px]">Name *</Label>
              <Input value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="Phase name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">Start Date</Label>
                <Input type="date" value={newPhaseStart} onChange={(e) => setNewPhaseStart(e.target.value)} className="mt-1 h-9 text-[13px]" />
              </div>
              <div>
                <Label className="text-[12px]">End Date</Label>
                <Input type="date" value={newPhaseEnd} onChange={(e) => setNewPhaseEnd(e.target.value)} className="mt-1 h-9 text-[13px]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">Status</Label>
                <Select value={newPhaseStatus} onValueChange={setNewPhaseStatus}>
                  <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]">Color</Label>
                <Input type="color" value={newPhaseColor} onChange={(e) => setNewPhaseColor(e.target.value)} className="mt-1 h-9" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
            <Button size="sm" className="h-9 text-[13px]" onClick={handleAddPhase} disabled={submitting || !newPhaseName.trim()}>
              {submitting ? 'Creating...' : 'Create Phase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
