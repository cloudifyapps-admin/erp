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
import { format } from 'date-fns'
import { Plus, AlertTriangle } from 'lucide-react'

interface Issue {
  id: string; title: string; description: string; severity: string; priority: string; status: string
  assigned_to: string; assigned_to_name: string; reported_by: string; reporter_name: string; created_at: string; resolved_at: string
}

interface Project { id: string; name: string }

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

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

export default function IssuesPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAddIssue, setShowAddIssue] = useState(false)
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [newIssueSeverity, setNewIssueSeverity] = useState('medium')
  const [newIssueDesc, setNewIssueDesc] = useState('')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchIssues = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/issues`, { params: { page_size: 100 } })
      setIssues(normalizePaginated<Issue>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchIssues() }, [fetchProject, fetchIssues])

  const handleAddIssue = async () => {
    if (!newIssueTitle) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/issues`, { title: newIssueTitle, severity: newIssueSeverity, description: newIssueDesc })
      toast.success('Issue added'); setShowAddIssue(false); setNewIssueTitle(''); setNewIssueDesc(''); fetchIssues()
    } catch { toast.error('Failed to add issue') } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Issues"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddIssue(true)}>
            <Plus className="h-3.5 w-3.5" />Add Issue
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Issues" count={issues.length} />
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issue</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reported By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={6} className="text-center py-16 text-muted-foreground text-[13px]">No issues tracked.</td></tr>
              )}
              {issues.map((iss) => (
                <tr key={iss.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-medium">{iss.title}</div>
                    {iss.description && <div className="text-[11px] text-muted-foreground/70 truncate max-w-xs mt-0.5">{iss.description}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    {(() => { const sev = iss.severity || iss.priority || 'medium'; return <span className={`text-[10px] px-2 py-0.5 rounded-md capitalize font-semibold ${PRIORITY_COLORS[sev] ?? 'bg-gray-100 text-gray-600'}`}>{sev}</span> })()}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={iss.status} /></td>
                  <td className="px-4 py-3.5 text-muted-foreground">{iss.assigned_to_name ?? '---'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{iss.reporter_name ?? '---'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{iss.created_at ? format(new Date(iss.created_at), 'MMM d, yyyy') : '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showAddIssue} onOpenChange={setShowAddIssue}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-[15px]">Add Issue</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-[12px]">Title</Label>
              <Input value={newIssueTitle} onChange={(e) => setNewIssueTitle(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="Issue title" />
            </div>
            <div>
              <Label className="text-[12px]">Severity</Label>
              <Select value={newIssueSeverity} onValueChange={setNewIssueSeverity}>
                <SelectTrigger className="mt-1 h-9 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Description</Label>
              <Textarea value={newIssueDesc} onChange={(e) => setNewIssueDesc(e.target.value)} className="mt-1 text-[13px]" rows={3} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
            <Button size="sm" className="h-9 text-[13px]" onClick={handleAddIssue} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
