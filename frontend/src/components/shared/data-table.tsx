'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteDialog } from './delete-dialog'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { toast } from 'sonner'

export type ColumnDef<T> = {
  key: string
  header?: string
  label?: string
  cell?: (row: T) => React.ReactNode
  render?: (row: T) => React.ReactNode
  className?: string
}

type PaginationMeta = {
  page: number
  per_page?: number
  pageSize?: number
  total: number
  pages?: number
  total_pages?: number
  onPageChange?: (page: number) => void
}

type DataTableProps<T extends { id: string | number }> = {
  columns: ColumnDef<T>[]
  data: T[]
  pagination?: PaginationMeta
  loading?: boolean
  editBasePath?: string
  deleteEndpoint?: string
  onDelete?: () => void
  emptyMessage?: string
  emptyDescription?: string
  additionalActions?: (row: T) => React.ReactNode
  onSearch?: (query: string) => void
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns + 1 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  pagination,
  loading = false,
  editBasePath,
  deleteEndpoint,
  onDelete,
  emptyMessage = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  additionalActions,
}: DataTableProps<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [deleteId, setDeleteId] = useState<string | number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const currentPage = pagination?.page ?? 1
  const totalPages = pagination?.total_pages ?? 1

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleDelete = async () => {
    if (!deleteId || !deleteEndpoint) return
    setDeleteLoading(true)
    try {
      await api.delete(`${deleteEndpoint}/${deleteId}`)
      toast.success('Record deleted successfully')
      setDeleteId(null)
      onDelete?.()
      router.refresh()
    } catch {
      toast.error('Failed to delete record')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              {columns.map((col) => (
                <TableHead key={col.key} className={cn('text-[0.75rem] font-semibold text-muted-foreground uppercase tracking-wide', col.className)}>
                  {col.header ?? col.label}
                </TableHead>
              ))}
              {(editBasePath || deleteEndpoint || additionalActions) && (
                <TableHead className="w-10" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton columns={columns.length} />
            ) : (!Array.isArray(data) || data.length === 0) ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-[0.85rem] font-semibold text-foreground">{emptyMessage}</p>
                    <p className="text-[0.75rem] text-muted-foreground">{emptyDescription}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              (Array.isArray(data) ? data : []).map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {(col.cell ?? col.render)
                        ? (col.cell ?? col.render)!(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </TableCell>
                  ))}
                  {(editBasePath || deleteEndpoint || additionalActions) && (
                    <TableCell className="w-10 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {editBasePath && (
                            <DropdownMenuItem asChild>
                              <Link href={`${editBasePath}/${row.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {additionalActions?.(row)}
                          {deleteEndpoint && editBasePath && (
                            <DropdownMenuSeparator />
                          )}
                          {deleteEndpoint && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteId(row.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (pagination.total_pages ?? pagination.pages ?? 1) > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            Showing {(currentPage - 1) * (pagination.per_page ?? pagination.pageSize ?? 10) + 1}–
            {Math.min(currentPage * (pagination.per_page ?? pagination.pageSize ?? 10), pagination.total)} of{' '}
            {pagination.total} records
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[0.75rem] font-medium px-2 tabular-nums text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}
