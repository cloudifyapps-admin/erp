'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import { Send, MessageSquare } from 'lucide-react'

interface Activity {
  id: string; type: string; comment_type: string
  user_name: string; user_avatar: string; content: string; body: string; created_at: string
  entity_type: string; entity_id: string
}

interface Project { id: string; name: string }

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-[14px] font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground/60">{description}</p>
    </div>
  )
}

export default function ActivityPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchActivities = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/activity`, { params: { page_size: 50 } })
      setActivities(normalizePaginated<Activity>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchActivities() }, [fetchProject, fetchActivities])

  const handlePostComment = async () => {
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/comments`, { body: commentText })
      toast.success('Comment posted'); setCommentText(''); fetchActivities()
    } catch { toast.error('Failed to post comment') } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Activity"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        {/* Comment input */}
        <div className="flex items-start gap-3 mb-6 p-4 rounded-lg border border-border/40 bg-muted/10">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-[12px] font-semibold text-primary shrink-0 mt-0.5">You</div>
          <div className="flex-1 flex flex-col gap-2">
            <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment... Use @mention to notify someone" className="text-[13px] min-h-[60px]" rows={2} />
            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-[12px] gap-1.5" onClick={handlePostComment} disabled={!commentText.trim() || submitting}>
                <Send className="size-3" />{submitting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0 max-w-3xl">
          {activities.length === 0 && (
            <EmptyState icon={MessageSquare} title="No activity yet" description="Comments and system events will appear here." />
          )}
          {activities.map((act, idx) => (
            <div key={act.id} className="flex gap-3 py-3 border-b border-border/20 last:border-b-0">
              <div className="flex flex-col items-center">
                <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                  {act.user_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                {idx < activities.length - 1 && <div className="w-px flex-1 bg-border/30 mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold">{act.user_name}</span>
                  <Badge variant="secondary" className="text-[9px] capitalize">{act.type || act.comment_type || 'comment'}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {act.created_at ? format(new Date(act.created_at), 'MMM d, h:mm a') : ''}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground/80 leading-relaxed">{act.content || act.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
