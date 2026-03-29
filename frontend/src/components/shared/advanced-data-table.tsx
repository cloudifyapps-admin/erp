'use client'

import { useState, useCallback, useEffect, useTransition, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type VisibilityState,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Columns3,
  GripVertical,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DeleteDialog } from './delete-dialog'
import api from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServerColumnDef<T> = {
  id: string
  header: string
  accessorKey?: string
  cell?: (row: T) => React.ReactNode
  enableSorting?: boolean
  enableHiding?: boolean
  meta?: {
    className?: string
    headerClassName?: string
    filterType?: 'select' | 'text'
    filterOptions?: { value: string; label: string }[]
    filterKey?: string
    filterPlaceholder?: string
  }
}

export type ServerPaginationMeta = {
  page: number
  per_page: number
  total: number
  pages: number
}

export type BulkAction = {
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'destructive'
  onClick: (selectedIds: (string | number)[]) => void | Promise<void>
}

export type AdvancedDataTableProps<T extends { id: string | number }> = {
  columns: ServerColumnDef<T>[]
  data: T[]
  pagination: ServerPaginationMeta
  loading?: boolean
  editBasePath?: string
  deleteEndpoint?: string
  onDelete?: () => void
  emptyMessage?: string
  emptyDescription?: string
  additionalActions?: (row: T) => React.ReactNode
  searchPlaceholder?: string
  enableSearch?: boolean
  storageKey?: string
  /** Title shown in the table header bar (e.g. "Leads") */
  title?: string
  /** Enable row selection with checkboxes */
  enableSelection?: boolean
  /** Bulk actions shown when rows are selected */
  bulkActions?: BulkAction[]
}

// ---------------------------------------------------------------------------
// Sortable column item for reordering
// ---------------------------------------------------------------------------

function SortableColumnItem({
  id,
  label,
  visible,
  onToggle,
}: {
  id: string
  label: string
  visible: boolean
  onToggle: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]',
        isDragging && 'z-50 bg-accent shadow-sm'
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground/50 hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox
        checked={visible}
        onCheckedChange={onToggle}
      />
      <span className="flex-1 truncate">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton rows — matching the reference with colored bars
// ---------------------------------------------------------------------------

function TableSkeleton({ columns }: { columns: number }) {
  const widths = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20']
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent border-0">
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j} className="py-5">
              <div
                className={cn(
                  'h-3 rounded-full animate-pulse',
                  widths[j % widths.length],
                  j === 0
                    ? 'bg-muted-foreground/10'
                    : j % 3 === 0
                      ? 'bg-primary/10'
                      : j % 3 === 1
                        ? 'bg-destructive/8'
                        : 'bg-muted-foreground/8'
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdvancedDataTable<T extends { id: string | number }>({
  columns: columnDefs,
  data,
  pagination,
  loading = false,
  editBasePath,
  deleteEndpoint,
  onDelete,
  emptyMessage = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  additionalActions,
  searchPlaceholder = 'Search...',
  enableSearch = true,
  storageKey = 'table',
  title,
  enableSelection = false,
  bulkActions = [],
}: AdvancedDataTableProps<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // Delete state
  const [deleteId, setDeleteId] = useState<string | number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => {
        const row = data[parseInt(key)]
        return row?.id
      })
      .filter(Boolean) as (string | number)[]
  }, [rowSelection, data])

  // Clear selection when data changes (e.g. page change, refresh)
  useEffect(() => {
    setRowSelection({})
  }, [data])

  // Filter popover open
  const [filterOpen, setFilterOpen] = useState(false)

  // Column visibility & order from localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(`${storageKey}-col-visibility`)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    if (typeof window === 'undefined') return columnDefs.map((c) => c.id)
    try {
      const stored = localStorage.getItem(`${storageKey}-col-order`)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        const allIds = columnDefs.map((c) => c.id)
        const validStored = parsed.filter((id: string) => allIds.includes(id))
        const missing = allIds.filter((id) => !validStored.includes(id))
        return [...validStored, ...missing]
      }
    } catch { /* ignore */ }
    return columnDefs.map((c) => c.id)
  })

  // Persist column preferences
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}-col-visibility`, JSON.stringify(columnVisibility))
    } catch { /* ignore */ }
  }, [columnVisibility, storageKey])

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}-col-order`, JSON.stringify(columnOrder))
    } catch { /* ignore */ }
  }, [columnOrder, storageKey])

  // Read URL state
  const currentPage = pagination.page
  const currentPerPage = pagination.per_page
  const currentSearch = searchParams.get('search') ?? ''
  const currentSortBy = searchParams.get('sort_by') ?? ''
  const currentSortDir = (searchParams.get('sort_direction') ?? 'desc') as 'asc' | 'desc'

  // URL helpers
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router, startTransition]
  )

  const goToPage = (page: number) => updateParams({ page: String(page) })

  const setPerPage = (perPage: string) => {
    updateParams({ per_page: perPage, page: '1' })
  }

  const handleSort = (columnId: string) => {
    if (currentSortBy === columnId) {
      if (currentSortDir === 'asc') {
        updateParams({ sort_by: columnId, sort_direction: 'desc', page: '1' })
      } else {
        updateParams({ sort_by: null, sort_direction: null, page: '1' })
      }
    } else {
      updateParams({ sort_by: columnId, sort_direction: 'asc', page: '1' })
    }
  }

  const handleSearch = (value: string) => {
    updateParams({ search: value || null, page: '1' })
  }

  const handleFilter = (key: string, value: string) => {
    updateParams({ [key]: value === 'all' ? null : value, page: '1' })
  }

  // Collect filter definitions from column meta
  const filterDefs = useMemo(
    () =>
      columnDefs
        .filter((col) => col.meta?.filterType)
        .map((col) => ({
          key: col.meta!.filterKey ?? col.id,
          type: col.meta!.filterType!,
          placeholder: col.meta?.filterPlaceholder ?? col.header,
          options: col.meta?.filterOptions ?? [],
        })),
    [columnDefs]
  )

  const activeFilterCount = filterDefs.filter((f) => searchParams.get(f.key)).length
  const hasActiveFilters = !!currentSearch || activeFilterCount > 0

  const clearAllFilters = () => {
    const clearUpdates: Record<string, null> = { search: null, page: null }
    for (const f of filterDefs) {
      clearUpdates[f.key] = null
    }
    updateParams(clearUpdates)
  }

  // Build tanstack columns
  const tanstackColumns: ColumnDef<T, unknown>[] = useMemo(
    () => [
      // Selection checkbox column
      ...(enableSelection
        ? [
            {
              id: '_select',
              header: ({ table: tbl }: { table: { getIsAllPageRowsSelected: () => boolean; getIsSomePageRowsSelected: () => boolean; toggleAllPageRowsSelected: (v: boolean) => void } }) => (
                <Checkbox
                  checked={tbl.getIsAllPageRowsSelected() || (tbl.getIsSomePageRowsSelected() && 'indeterminate')}
                  onCheckedChange={(value) => tbl.toggleAllPageRowsSelected(!!value)}
                  aria-label="Select all"
                  className="translate-y-[2px]"
                />
              ),
              cell: ({ row }: { row: { getIsSelected: () => boolean; toggleSelected: (v: boolean) => void; getCanSelect: () => boolean } }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  aria-label="Select row"
                  className="translate-y-[2px]"
                />
              ),
              enableSorting: false,
              enableHiding: false,
            } as ColumnDef<T, unknown>,
          ]
        : []),
      ...columnDefs.map((col) => ({
        id: col.id,
        accessorKey: col.accessorKey ?? col.id,
        header: col.header,
        cell: col.cell
          ? ({ row }: { row: { original: T } }) => col.cell!(row.original)
          : undefined,
        enableSorting: col.enableSorting ?? true,
        enableHiding: col.enableHiding ?? true,
      })),
      // Actions column
      ...((editBasePath || deleteEndpoint || additionalActions)
        ? [
            {
              id: '_actions',
              header: '',
              enableSorting: false,
              enableHiding: false,
              cell: ({ row }: { row: { original: T } }) => (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {editBasePath && (
                        <DropdownMenuItem asChild>
                          <Link href={`${editBasePath}/${row.original.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {additionalActions?.(row.original)}
                      {deleteEndpoint && editBasePath && <DropdownMenuSeparator />}
                      {deleteEndpoint && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(row.original.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ),
            },
          ]
        : []),
    ],
    [columnDefs, editBasePath, deleteEndpoint, additionalActions]
  )

  // Sorting state (for visual indicators only — actual sort is server-side)
  const sorting: SortingState = currentSortBy
    ? [{ id: currentSortBy, desc: currentSortDir === 'desc' }]
    : []

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: {
      columnVisibility,
      columnOrder: [...(enableSelection ? ['_select'] : []), ...columnOrder, '_actions'],
      sorting,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination.pages,
    enableRowSelection: enableSelection,
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  // Delete handler
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

  // Column reset
  const resetColumns = () => {
    setColumnVisibility({})
    setColumnOrder(columnDefs.map((c) => c.id))
  }

  const totalPages = pagination.pages
  const totalRecords = pagination.total

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* ================================================================ */}
      {/* TOOLBAR — matches UAE stocks header                              */}
      {/* ================================================================ */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-border/50">
        {/* Title + count badge */}
        {title && (
          <div className="flex items-center gap-2.5 mr-2">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] font-medium tabular-nums">
              {totalRecords}
            </Badge>
          </div>
        )}

        {/* Search */}
        {enableSearch && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder={searchPlaceholder}
              defaultValue={currentSearch}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 rounded-lg border-border/50 bg-muted/30 pl-9 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background"
            />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 px-3 text-sm text-muted-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        )}

        {/* Filter button → opens slide-out sheet */}
        {filterDefs.length > 0 && (
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg border-border/60 px-4 text-sm font-medium gap-2 cursor-pointer"
              onClick={() => setFilterOpen(true)}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="default" className="h-4 min-w-4 rounded-full px-1 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <SheetContent side="right" className="w-[320px] sm:max-w-[320px]">
              <SheetHeader className="border-b border-border/40 pb-4">
                <SheetTitle className="text-base">Filters</SheetTitle>
                <SheetDescription className="text-[13px]">
                  Narrow down results using the options below.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 py-5 flex-1 overflow-y-auto">
                {filterDefs.map((filter) => (
                  <div key={filter.key} className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {filter.placeholder}
                    </label>
                    {filter.type === 'select' ? (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => handleFilter(filter.key, 'all')}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
                            !searchParams.get(filter.key) || searchParams.get(filter.key) === 'all'
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                          )}
                        >
                          All
                        </button>
                        {filter.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleFilter(filter.key, opt.value)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer',
                              searchParams.get(filter.key) === opt.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Select
                        value={searchParams.get(filter.key) ?? 'all'}
                        onValueChange={(value) => handleFilter(filter.key, value)}
                      >
                        <SelectTrigger className="h-9 text-sm rounded-lg">
                          <SelectValue placeholder={filter.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {filter.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>

              <SheetFooter className="border-t border-border/40 pt-4">
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clearAllFilters()
                      setFilterOpen(false)
                    }}
                    className="w-full rounded-lg"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Clear all filters
                  </Button>
                )}
                <SheetClose asChild>
                  <Button size="sm" className="w-full rounded-lg">
                    Done
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}

        {/* Column settings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 rounded-lg border-border/60 px-4 text-sm font-medium gap-2 cursor-pointer">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[240px] p-0">
            <div className="flex items-center justify-between px-3 py-2.5 border-b">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Toggle & Reorder
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetColumns}
                className="h-6 px-2 text-[11px]"
              >
                Reset
              </Button>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={columnOrder}
                  strategy={verticalListSortingStrategy}
                >
                  {columnOrder
                    .filter((id) => columnDefs.some((c) => c.id === id))
                    .map((id) => {
                      const col = columnDefs.find((c) => c.id === id)!
                      return (
                        <SortableColumnItem
                          key={id}
                          id={id}
                          label={col.header}
                          visible={columnVisibility[id] !== false}
                          onToggle={() =>
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [id]: prev[id] === false ? true : false,
                            }))
                          }
                        />
                      )
                    })}
                </SortableContext>
              </DndContext>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ================================================================ */}
      {/* BULK ACTION BAR                                                  */}
      {/* ================================================================ */}
      {enableSelection && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border/50 bg-primary/5">
          <span className="text-sm font-medium text-primary">
            {selectedIds.length} row{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                size="sm"
                className="h-8 rounded-lg px-3 text-xs font-medium gap-1.5"
                onClick={() => action.onClick(selectedIds)}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-muted-foreground"
            onClick={() => setRowSelection({})}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear selection
          </Button>
        </div>
      )}

      {/* ================================================================ */}
      {/* TABLE                                                            */}
      {/* ================================================================ */}
      <div className={cn('overflow-x-auto transition-opacity duration-150', loading && data.length > 0 && 'opacity-50 pointer-events-none')}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-border/40">
                {headerGroup.headers.map((header) => {
                  const colDef = columnDefs.find((c) => c.id === header.id)
                  const isSortable = colDef?.enableSorting !== false && header.id !== '_actions' && header.id !== '_select'
                  const isSorted = currentSortBy === header.id
                  const sortDir = isSorted ? currentSortDir : null

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-11 px-6 first:pl-6 last:pr-6',
                        header.id === '_select' && 'w-12 px-4',
                        header.id === '_actions' && 'w-12',
                        colDef?.meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder ? null : isSortable ? (
                        <button
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors cursor-pointer',
                            'text-muted-foreground/70 hover:text-foreground',
                            isSorted && 'text-foreground'
                          )}
                          onClick={() => handleSort(header.id)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowDown className="h-3 w-3 text-primary" />
                            ) : (
                              <ArrowUp className="h-3 w-3 text-primary" />
                            )
                          ) : null}
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              <TableSkeleton columns={table.getVisibleFlatColumns().length} />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="h-48 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                      <Search className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-foreground/80 mt-1">{emptyMessage}</p>
                    <p className="text-xs text-muted-foreground">{emptyDescription}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="group border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-6 py-4 first:pl-6 last:pr-6 text-[13px]',
                        columnDefs.find((c) => c.id === cell.column.id)?.meta?.className
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ================================================================ */}
      {/* PAGINATION — Previous / 1 2 3 ... 8 9 10 / Next                 */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between border-t border-border/40 px-6 py-4">
        {/* Left: rows per page */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Rows per page</span>
            <Select
              value={String(currentPerPage)}
              onValueChange={setPerPage}
            >
              <SelectTrigger className="h-8 w-[62px] text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Center: page numbers */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* Previous */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="h-9 rounded-lg border-border/60 px-3.5 text-sm font-medium gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-0.5 mx-1">
              {generatePageNumbers(currentPage, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="w-9 text-center text-sm text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    disabled={loading}
                    className={cn(
                      'h-9 min-w-9 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                      p === currentPage
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            {/* Next */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="h-9 rounded-lg border-border/60 px-3.5 text-sm font-medium gap-1.5 cursor-pointer"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Right: record count */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalRecords === 0
            ? 'No records'
            : `${(currentPage - 1) * currentPerPage + 1}–${Math.min(currentPage * currentPerPage, totalRecords)} of ${totalRecords}`}
        </span>
      </div>

      {/* ---- Delete Dialog ---- */}
      <DeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePageNumbers(
  current: number,
  total: number
): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = []

  // Always show first 3 pages
  pages.push(1)
  if (total > 1) pages.push(2)
  if (total > 2) pages.push(3)

  if (current > 4) {
    pages.push('...')
  }

  // Pages around current (if not already included)
  const start = Math.max(4, current - 1)
  const end = Math.min(total - 3, current + 1)
  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) pages.push(i)
  }

  if (current < total - 3) {
    pages.push('...')
  }

  // Always show last 3 pages
  for (let i = Math.max(total - 2, 4); i <= total; i++) {
    if (!pages.includes(i)) pages.push(i)
  }

  return pages
}
