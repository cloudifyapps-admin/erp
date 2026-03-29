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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Plus, ShieldAlert } from 'lucide-react'

interface Risk {
  id: string; title: string; description: string; probability: string; impact: string
  risk_score: number; status: string; mitigation_plan: string; owner_name: string; category: string
}

const LEVEL_MAP: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5, critical: 5 }
const NUM_TO_LEVEL: Record<string, string> = { '1': 'very_low', '2': 'low', '3': 'medium', '4': 'high', '5': 'very_high' }
function levelToNum(level: string | number): number {
  if (typeof level === 'number') return level
  return LEVEL_MAP[level] ?? 3
}
function levelLabel(level: string | number): string {
  if (typeof level === 'number') return String(level)
  return level.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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

function RiskMatrix({ risks }: { risks: Risk[] }) {
  const getCellColor = (p: number, i: number) => {
    const score = p * i
    if (score >= 15) return 'bg-red-100 dark:bg-red-900/30'
    if (score >= 10) return 'bg-orange-100 dark:bg-orange-900/30'
    if (score >= 5) return 'bg-yellow-100 dark:bg-yellow-900/30'
    return 'bg-green-100 dark:bg-green-900/30'
  }
  const getRisksInCell = (p: number, i: number) => risks.filter((r) => levelToNum(r.probability) === p && levelToNum(r.impact) === i)

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">Risk Matrix (Probability x Impact)</h4>
      <div className="inline-flex flex-col gap-0">
        <div className="flex items-center">
          <div className="w-16" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-20 text-center text-[10px] text-muted-foreground font-medium py-1">Impact {i}</div>
          ))}
        </div>
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} className="flex items-stretch">
            <div className="w-16 flex items-center justify-end pr-2 text-[10px] text-muted-foreground font-medium">Prob {p}</div>
            {[1, 2, 3, 4, 5].map((i) => {
              const cellRisks = getRisksInCell(p, i)
              return (
                <div key={i} className={`w-20 h-16 border border-border/30 ${getCellColor(p, i)} flex items-center justify-center gap-1 flex-wrap p-1 relative`} title={`Score: ${p * i}`}>
                  <span className="absolute top-0.5 right-1 text-[9px] text-muted-foreground/50 tabular-nums">{p * i}</span>
                  {cellRisks.map((r) => (
                    <div key={r.id} className="size-4 rounded-full bg-foreground/70 border border-background cursor-pointer" title={r.title} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RisksPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAddRisk, setShowAddRisk] = useState(false)
  const [newRiskTitle, setNewRiskTitle] = useState('')
  const [newRiskProb, setNewRiskProb] = useState('3')
  const [newRiskImpact, setNewRiskImpact] = useState('3')
  const [newRiskMitigation, setNewRiskMitigation] = useState('')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchRisks = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/risks`, { params: { page_size: 100 } })
      setRisks(normalizePaginated<Risk>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchRisks() }, [fetchProject, fetchRisks])

  const handleAddRisk = async () => {
    if (!newRiskTitle) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/risks`, {
        title: newRiskTitle, probability: NUM_TO_LEVEL[newRiskProb] ?? 'medium', impact: NUM_TO_LEVEL[newRiskImpact] ?? 'medium', mitigation_plan: newRiskMitigation,
      })
      toast.success('Risk added'); setShowAddRisk(false); setNewRiskTitle(''); setNewRiskMitigation(''); fetchRisks()
    } catch { toast.error('Failed to add risk') } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Risks"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddRisk(true)}>
            <Plus className="h-3.5 w-3.5" />Add Risk
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Risk Register" count={risks.length} />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6">
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">P</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">I</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                </tr>
              </thead>
              <tbody>
                {risks.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-muted-foreground text-[13px]">No risks identified.</td></tr>
                )}
                {risks.map((r) => {
                  const score = levelToNum(r.probability) * levelToNum(r.impact)
                  const scoreColor = score >= 15 ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : score >= 10 ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' : score >= 5 ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  return (
                    <tr key={r.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-medium">{r.title}</div>
                        {r.mitigation_plan && <div className="text-[11px] text-muted-foreground/70 truncate max-w-xs mt-0.5">{r.mitigation_plan}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums">{levelLabel(r.probability)}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums">{levelLabel(r.impact)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums ${scoreColor}`}>{score}</span>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3.5 text-muted-foreground">{r.owner_name ?? '---'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {risks.length > 0 && <RiskMatrix risks={risks} />}
        </div>
      </div>

      <Dialog open={showAddRisk} onOpenChange={setShowAddRisk}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Add Risk</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-[12px]">Title</Label>
              <Input value={newRiskTitle} onChange={(e) => setNewRiskTitle(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="Risk description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px]">Probability (1-5)</Label>
                <Select value={newRiskProb} onValueChange={setNewRiskProb}>
                  <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((v) => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]">Impact (1-5)</Label>
                <Select value={newRiskImpact} onValueChange={setNewRiskImpact}>
                  <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((v) => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[12px]">Mitigation Plan</Label>
              <Textarea value={newRiskMitigation} onChange={(e) => setNewRiskMitigation(e.target.value)} className="mt-1 text-[13px]" rows={3} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
            <Button size="sm" className="h-9 text-[13px]" onClick={handleAddRisk} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Risk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
