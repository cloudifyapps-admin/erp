import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

type BreadcrumbItem = {
  label: string
  href?: string
}

type PageHeaderProps = {
  title: string
  breadcrumbs?: BreadcrumbItem[]
  createHref?: string
  createLabel?: string
  createIcon?: LucideIcon
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  breadcrumbs,
  createHref,
  createLabel = 'Create',
  createIcon: CreateIcon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {actions}
          {createHref && (
            <Button asChild>
              <Link href={createHref}>
                {CreateIcon && <CreateIcon className="mr-1.5 h-4 w-4" />}
                {createLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
