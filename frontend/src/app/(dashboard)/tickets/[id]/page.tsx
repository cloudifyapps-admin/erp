'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ArrowLeft, Send, Lock, Globe, User2, Clock } from 'lucide-react';

interface TicketComment {
  id: string;
  body: string;
  is_internal: boolean;
  author_name: string;
  author_avatar?: string;
  created_at: string;
}

interface Ticket {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  assignee_id: string;
  assignee_name: string;
  requester_name: string;
  requester_email: string;
  created_at: string;
  updated_at: string;
  resolved_at: string;
  tags: string[];
}

interface TeamMember {
  id: string;
  full_name: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    try {
      const [ticketRes, commentsRes] = await Promise.all([
        api.get(`/tickets/${ticketId}/`),
        api.get(`/tickets/${ticketId}/comments`),
      ]);
      setTicket(ticketRes.data);
      setComments(commentsRes.data.items ?? commentsRes.data);
    } catch {
      toast.error('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  useEffect(() => {
    api.get('/settings/team-members', { params: { page_size: 200 } })
      .then(({ data }) => setTeamMembers(normalizePaginated(data).items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const updateTicket = async (field: Partial<Ticket>) => {
    try {
      const { data } = await api.patch(`/tickets/${ticketId}/`, field);
      setTicket(data);
      toast.success('Ticket updated');
    } catch {
      toast.error('Failed to update ticket');
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/tickets/${ticketId}/comments/`, {
        body: commentText,
        is_internal: isInternal,
      });
      setComments((c) => [...c, data]);
      setCommentText('');
      toast.success('Comment added');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading ticket…</div>;
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-start gap-4">
        <Button size="icon-sm" variant="ghost" onClick={() => router.push('/tickets')}>
          <ArrowLeft />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{ticket.number}</span>
            <StatusBadge status={ticket.status} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLES[ticket.priority] ?? 'bg-gray-100 text-gray-700'}`}>
              {ticket.priority}
            </span>
          </div>
          <h1 className="text-lg font-semibold mt-1">{ticket.title}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Description */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
              {ticket.description || 'No description provided.'}
            </p>
            {ticket.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {ticket.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Comments ({comments.length})
            </h3>
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet. Be the first to reply.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className={`rounded-lg p-4 ${c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-muted/40'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User2 className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{c.author_name}</span>
                  {c.is_internal && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      <Lock className="size-3" /> Internal
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {format(new Date(c.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">{c.body}</p>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* Compose */}
          <div className="border-t p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Label htmlFor="internal-toggle" className="text-sm text-muted-foreground">
                {isInternal ? (
                  <span className="flex items-center gap-1.5 text-amber-700"><Lock className="size-3.5" /> Internal note</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Globe className="size-3.5" /> Public reply</span>
                )}
              </Label>
              <Switch
                id="internal-toggle"
                checked={isInternal}
                onCheckedChange={setIsInternal}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
            <div className={`rounded-lg border ${isInternal ? 'border-amber-200 bg-amber-50/50' : ''}`}>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={isInternal ? 'Write an internal note…' : 'Write a public reply…'}
                rows={3}
                className="border-0 resize-none focus-visible:ring-0 rounded-b-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment();
                }}
              />
              <div className="flex justify-end p-2 border-t">
                <Button size="sm" onClick={submitComment} disabled={submitting || !commentText.trim()}>
                  <Send className="size-3.5" />
                  {submitting ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l overflow-auto p-4 flex flex-col gap-5 shrink-0">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
            <Select value={ticket.status} onValueChange={(v) => updateTicket({ status: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Priority</Label>
            <Select value={ticket.priority} onValueChange={(v) => updateTicket({ priority: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Category</Label>
            <Select value={ticket.category} onValueChange={(v) => updateTicket({ category: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Assignee</Label>
            <Select
              value={ticket.assignee_id ?? '__none__'}
              onValueChange={(v) => updateTicket({ assignee_id: v === '__none__' ? null : v } as Partial<Ticket>)}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Requester</span>
              <span className="font-medium">{ticket.requester_name}</span>
              {ticket.requester_email && <span className="text-xs text-muted-foreground">{ticket.requester_email}</span>}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Created</span>
              <span>{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Last Updated</span>
              <span>{format(new Date(ticket.updated_at), 'MMM d, yyyy HH:mm')}</span>
            </div>
            {ticket.resolved_at && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Resolved</span>
                <span>{format(new Date(ticket.resolved_at), 'MMM d, yyyy HH:mm')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
