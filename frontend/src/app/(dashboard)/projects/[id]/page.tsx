'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import {
  ArrowLeft, Plus, Clock, CheckCircle2, AlertCircle, Circle,
  Calendar, User2, DollarSign, GripVertical, MoreVertical,
  Target, Timer
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: string;
  assignee_name: string;
  due_date: string;
  estimated_hours: number;
}

interface Milestone {
  id: string;
  title: string;
  due_date: string;
  status: string;
  progress: number;
}

interface TimeLog {
  id: string;
  task_title: string;
  user_name: string;
  hours: number;
  description: string;
  logged_at: string;
}

interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  manager_name: string;
  client_name: string;
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
  total_tasks: number;
  completed_tasks: number;
  total_hours: number;
}

const KANBAN_COLUMNS: { key: Task['status']; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'todo', label: 'To Do', icon: <Circle className="size-4" />, color: 'text-slate-600' },
  { key: 'in_progress', label: 'In Progress', icon: <Clock className="size-4" />, color: 'text-blue-600' },
  { key: 'review', label: 'Review', icon: <AlertCircle className="size-4" />, color: 'text-orange-600' },
  { key: 'done', label: 'Done', icon: <CheckCircle2 className="size-4" />, color: 'text-green-600' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

function KanbanCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: Task['status']) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`group rounded-lg border bg-background p-3 shadow-xs cursor-grab active:cursor-grabbing transition-opacity ${dragging ? 'opacity-40' : 'opacity-100'} hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <GripVertical className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
      </div>
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {task.priority && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
            {task.priority}
          </span>
        )}
        {task.due_date && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="size-3" />
            {format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        {task.assignee_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <User2 className="size-3" />
            {task.assignee_name.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  column, tasks, onDrop, onStatusChange,
}: {
  column: typeof KANBAN_COLUMNS[0];
  tasks: Task[];
  onDrop: (taskId: string, status: Task['status']) => void;
  onStatusChange: (id: string, status: Task['status']) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex flex-col gap-2 min-w-[260px] flex-1 rounded-xl bg-muted/40 p-3 transition-colors ${dragOver ? 'bg-muted/70 ring-2 ring-primary/20' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) onDrop(taskId, column.key);
      }}
    >
      <div className={`flex items-center gap-2 px-1 pb-1 ${column.color}`}>
        {column.icon}
        <span className="text-sm font-semibold">{column.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-background rounded-full px-1.5 py-0.5 border">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2 min-h-[80px]">
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}`);
      setProject(data);
    } catch {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params: { page_size: 200 } });
      setTasks(normalizePaginated(data).items);
    } catch {
      toast.error('Failed to load tasks');
    }
  }, [projectId]);

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, { params: { page_size: 100 } });
      setMilestones(normalizePaginated(data).items);
    } catch {}
  }, [projectId]);

  const fetchTimeLogs = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/time-logs`, { params: { page_size: 100 } });
      setTimeLogs(normalizePaginated(data).items);
    } catch {}
  }, [projectId]);

  useEffect(() => { fetchProject(); fetchTasks(); }, [fetchProject, fetchTasks]);

  useEffect(() => {
    if (activeTab === 'milestones') fetchMilestones();
    if (activeTab === 'timelog') fetchTimeLogs();
  }, [activeTab, fetchMilestones, fetchTimeLogs]);

  const handleDrop = async (taskId: string, newStatus: Task['status']) => {
    const prevTasks = tasks;
    setTasks((ts) => ts.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, { status: newStatus });
    } catch {
      setTasks(prevTasks);
      toast.error('Failed to update task');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading project…</div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const tasksByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {} as Record<Task['status'], Task[]>);

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-start gap-4">
        <Button size="icon-sm" variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold truncate">{project.name}</h1>
            <Badge variant="outline" className="font-mono text-xs">{project.code}</Badge>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{project.client_name ?? 'Internal project'}</p>
        </div>
        <Button size="sm">
          <Plus /> New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border">
        {[
          { icon: <Target className="size-4 text-muted-foreground" />, label: 'Progress', value: `${project.progress ?? 0}%` },
          { icon: <CheckCircle2 className="size-4 text-muted-foreground" />, label: 'Tasks', value: `${project.completed_tasks ?? 0}/${project.total_tasks ?? 0}` },
          { icon: <Timer className="size-4 text-muted-foreground" />, label: 'Hours Logged', value: `${(project.total_hours ?? 0).toLocaleString()}h` },
          { icon: <DollarSign className="size-4 text-muted-foreground" />, label: 'Budget', value: project.budget ? `${project.currency} ${Number(project.budget).toLocaleString()}` : '—' },
        ].map((s) => (
          <div key={s.label} className="bg-background px-6 py-3 flex items-center gap-3">
            {s.icon}
            <div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-sm font-semibold">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="px-6 pt-2 border-b rounded-none bg-transparent justify-start gap-1 h-auto pb-0">
          {[
            { value: 'overview', label: 'Overview' },
            { value: 'kanban', label: 'Kanban' },
            { value: 'tasks', label: 'Tasks' },
            { value: 'milestones', label: 'Milestones' },
            { value: 'timelog', label: 'Time Log' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.value
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl flex flex-col gap-6">
            <Card className="p-6 flex flex-col gap-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Description</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 flex flex-col gap-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Details</h3>
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Manager</dt>
                    <dd className="font-medium">{project.manager_name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Priority</dt>
                    <dd className="capitalize font-medium">{project.priority ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Start Date</dt>
                    <dd>{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">End Date</dt>
                    <dd>{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : '—'}</dd>
                  </div>
                </dl>
              </Card>
              <Card className="p-4 flex flex-col gap-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Progress</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall</span>
                    <span className="font-medium">{project.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${project.progress ?? 0}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {KANBAN_COLUMNS.map((col) => (
                    <div key={col.key} className="flex items-center gap-2 text-sm">
                      <span className={col.color}>{col.icon}</span>
                      <span className="text-muted-foreground text-xs">{col.label}</span>
                      <span className="ml-auto font-medium text-xs">{tasksByStatus[col.key]?.length ?? 0}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Kanban */}
        <TabsContent value="kanban" className="flex-1 overflow-auto p-6">
          <div className="flex gap-4 h-full min-w-max">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={tasksByStatus[col.key] ?? []}
                onDrop={handleDrop}
                onStatusChange={(id, status) => handleDrop(id, status)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Tasks list */}
        <TabsContent value="tasks" className="flex-1 overflow-auto p-6">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Assignee</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Est. Hours</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">No tasks yet</td>
                  </tr>
                )}
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{t.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.assignee_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize font-medium ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.estimated_hours ?? '—'}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Milestones */}
        <TabsContent value="milestones" className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl flex flex-col gap-3">
            {milestones.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-12">No milestones defined</p>
            )}
            {milestones.map((m) => (
              <Card key={m.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{m.title}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Due: {m.due_date ? format(new Date(m.due_date), 'MMM d, yyyy') : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-28">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${m.progress ?? 0}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{m.progress ?? 0}%</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Time Log */}
        <TabsContent value="timelog" className="flex-1 overflow-auto p-6">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Team Member</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Hours</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">No time logs yet</td>
                  </tr>
                )}
                {timeLogs.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{l.task_title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.user_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{l.hours}h</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.logged_at ? format(new Date(l.logged_at), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
