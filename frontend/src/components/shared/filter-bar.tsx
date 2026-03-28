'use client'

import { useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FilterOption = {
  value: string
  label: string
}

type FilterBarProps = {
  searchPlaceholder?: string
  filters?: {
    key: string
    placeholder: string
    options: FilterOption[]
  }[]
}

export function FilterBar({ searchPlaceholder = 'Search...', filters = [] }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === 'all') {
          params.delete(key)
        } else {
          params.set(key, value)
          params.delete('page')
        }
      }
      return params.toString()
    },
    [searchParams]
  )

  const handleSearch = (value: string) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ search: value || null })}`)
    })
  }

  const handleFilter = (key: string, value: string) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ [key]: value })}`)
    })
  }

  const hasActiveFilters =
    searchParams.get('search') ||
    filters.some((f) => searchParams.get(f.key))

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          defaultValue={searchParams.get('search') ?? ''}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-8 h-8"
        />
      </div>
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={searchParams.get(filter.key) ?? 'all'}
          onValueChange={(value) => handleFilter(filter.key, value)}
        >
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filter.placeholder}</SelectItem>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2">
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
