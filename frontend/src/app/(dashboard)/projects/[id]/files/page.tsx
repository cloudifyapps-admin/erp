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
import { format } from 'date-fns'
import { Paperclip, Upload, Download, Trash2, LayoutDashboard, ListChecks } from 'lucide-react'

interface ProjectFile {
  id: string; name: string; size: number; mime_type: string
  uploaded_by: string; uploaded_at: string; url: string
}

interface Project { id: string; name: string }

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

function EmptyState({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-[14px] font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground/60 mb-4">{description}</p>
      {action}
    </div>
  )
}

export default function FilesPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [filesView, setFilesView] = useState<'grid' | 'list'>('grid')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/files`, { params: { page_size: 100 } })
      setFiles(normalizePaginated<ProjectFile>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchFiles() }, [fetchProject, fetchFiles])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post(`/projects/${projectId}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('File uploaded'); fetchFiles()
    } catch { toast.error('Failed to upload file') }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api.delete(`/projects/${projectId}/files/${fileId}`)
      toast.success('File deleted'); fetchFiles()
    } catch { toast.error('Failed to delete file') }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Files"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
        actions={
          <label>
            <input type="file" className="hidden" onChange={handleFileUpload} />
            <Button size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold shadow-sm gap-1.5 cursor-pointer" asChild>
              <span><Upload className="h-3.5 w-3.5" />Upload File</span>
            </Button>
          </label>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <SectionHeader
          title="Files"
          count={files.length}
          action={
            <div className="flex rounded-lg border border-border/40 overflow-hidden">
              <Button variant={filesView === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-7 rounded-none px-2" onClick={() => setFilesView('grid')}>
                <LayoutDashboard className="size-3.5" />
              </Button>
              <Button variant={filesView === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 rounded-none px-2" onClick={() => setFilesView('list')}>
                <ListChecks className="size-3.5" />
              </Button>
            </div>
          }
        />

        {files.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="No files attached"
            description="Upload files to share with the team."
            action={
              <label>
                <input type="file" className="hidden" onChange={handleFileUpload} />
                <Button size="sm" className="h-8 text-[12px] gap-1.5 cursor-pointer" asChild>
                  <span><Upload className="size-3.5" />Upload File</span>
                </Button>
              </label>
            }
          />
        ) : filesView === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((f) => (
              <div key={f.id} className="rounded-lg border border-border/40 p-4 hover:bg-muted/10 transition-colors group">
                <div className="flex items-center justify-center h-20 mb-3 rounded bg-muted/20">
                  <Paperclip className="size-8 text-muted-foreground/30" />
                </div>
                <p className="text-[12px] font-medium truncate">{f.name}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>{formatFileSize(f.size)}</span>
                  <span>{f.uploaded_at ? format(new Date(f.uploaded_at), 'MMM d') : ''}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(f.url, '_blank')}>
                    <Download className="size-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDeleteFile(f.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Size</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uploaded By</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5 font-medium">{f.name}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{formatFileSize(f.size)}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{f.uploaded_by}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{f.uploaded_at ? format(new Date(f.uploaded_at), 'MMM d, yyyy') : '---'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(f.url, '_blank')}>
                          <Download className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteFile(f.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
