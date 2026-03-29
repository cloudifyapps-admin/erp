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
import { format } from 'date-fns'
import { FileText } from 'lucide-react'

interface StatusReport {
  id: string; title: string; period: string; period_type: string; status: string
  created_by: string; created_by_name: string; created_at: string; summary: string
  report_date: string; period_start: string; period_end: string
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

export default function ReportsPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [reports, setReports] = useState<StatusReport[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchReports = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/status-reports`, { params: { page_size: 50 } })
      setReports(normalizePaginated<StatusReport>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchReports() }, [fetchProject, fetchReports])

  const handleGenerateReport = async () => {
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/status-reports/generate`, { period_type: 'weekly' })
      toast.success('Report generated'); fetchReports()
    } catch { toast.error('Failed to generate report') } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reports"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={handleGenerateReport} disabled={submitting}>
            <FileText className="h-3.5 w-3.5" />
            {submitting ? 'Generating...' : 'Auto-Generate Report'}
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Status Reports" count={reports.length} />
        <div className="flex flex-col gap-3 max-w-3xl">
          {reports.length === 0 && (
            <EmptyState icon={FileText} title="No reports yet" description="Generate status reports to keep stakeholders informed." />
          )}
          {reports.map((rpt) => (
            <div key={rpt.id} className="rounded-lg border border-border/40 p-5 hover:bg-muted/10 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[13px] font-semibold">{rpt.title}</span>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{rpt.period || (rpt.period_start && rpt.period_end ? `${format(new Date(rpt.period_start), 'MMM d')} - ${format(new Date(rpt.period_end), 'MMM d, yyyy')}` : rpt.period_type)}</span>
                    <span>by {rpt.created_by_name ?? rpt.created_by}</span>
                    <span>{rpt.created_at ? format(new Date(rpt.created_at), 'MMM d, yyyy') : ''}</span>
                  </div>
                </div>
                <StatusBadge status={rpt.status} />
              </div>
              {rpt.summary && <p className="mt-2 text-[12px] text-muted-foreground line-clamp-2">{rpt.summary}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
