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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Plus, Calendar, Users, CheckCircle2, Eye, Video } from 'lucide-react'

interface Meeting {
  id: string; title: string; meeting_date: string; date: string; attendees: string[]
  notes: string; action_items: string[]; created_by: string
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

export default function MeetingsPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingDate, setNewMeetingDate] = useState('')
  const [newMeetingAgenda, setNewMeetingAgenda] = useState('')
  const [newMeetingNotes, setNewMeetingNotes] = useState('')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchMeetings = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/meetings`, { params: { page_size: 50 } })
      setMeetings(normalizePaginated<Meeting>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchMeetings() }, [fetchProject, fetchMeetings])

  const handleAddMeeting = async () => {
    if (!newMeetingTitle.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/projects/${projectId}/meetings`, {
        title: newMeetingTitle,
        meeting_date: newMeetingDate || null,
        agenda: newMeetingAgenda || null,
        notes: newMeetingNotes || null,
      })
      toast.success('Meeting added')
      setShowAddMeeting(false)
      setNewMeetingTitle(''); setNewMeetingDate(''); setNewMeetingAgenda(''); setNewMeetingNotes('')
      fetchMeetings()
    } catch { toast.error('Failed to add meeting') } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Meetings"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5" onClick={() => setShowAddMeeting(true)}>
            <Plus className="h-3.5 w-3.5" />Add Meeting
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader title="Meeting Notes" count={meetings.length} />
        <div className="flex flex-col gap-3 max-w-3xl">
          {meetings.length === 0 && (
            <EmptyState icon={Video} title="No meetings recorded" description="Add meeting notes to keep the team aligned." />
          )}
          {meetings.map((mtg) => {
            const displayDate = mtg.meeting_date || mtg.date
            return (
              <div key={mtg.id} className="rounded-lg border border-border/40 p-5 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[13px] font-semibold">{mtg.title}</span>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {displayDate ? format(new Date(displayDate), 'MMM d, yyyy h:mm a') : '---'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {mtg.attendees?.length ?? 0} attendees
                      </span>
                      {mtg.created_by && <span>by {mtg.created_by}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Eye className="size-4" />
                  </Button>
                </div>
                {mtg.notes && <p className="mt-2 text-[12px] text-muted-foreground line-clamp-2">{mtg.notes}</p>}
                {mtg.action_items && mtg.action_items.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="size-3" />
                    {mtg.action_items.length} action items
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={showAddMeeting} onOpenChange={setShowAddMeeting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Add Meeting</DialogTitle>
            <DialogDescription>Record a new meeting for this project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-[12px]">Title *</Label>
              <Input value={newMeetingTitle} onChange={(e) => setNewMeetingTitle(e.target.value)} className="mt-1 h-9 text-[13px]" placeholder="Meeting title" />
            </div>
            <div>
              <Label className="text-[12px]">Date & Time</Label>
              <Input type="datetime-local" value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)} className="mt-1 h-9 text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px]">Agenda</Label>
              <Textarea value={newMeetingAgenda} onChange={(e) => setNewMeetingAgenda(e.target.value)} className="mt-1 text-[13px]" rows={2} placeholder="Meeting agenda..." />
            </div>
            <div>
              <Label className="text-[12px]">Notes</Label>
              <Textarea value={newMeetingNotes} onChange={(e) => setNewMeetingNotes(e.target.value)} className="mt-1 text-[13px]" rows={3} placeholder="Meeting notes..." />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline" size="sm" className="h-9 text-[13px]">Cancel</Button></DialogClose>
            <Button size="sm" className="h-9 text-[13px]" onClick={handleAddMeeting} disabled={submitting || !newMeetingTitle.trim()}>
              {submitting ? 'Adding...' : 'Add Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
