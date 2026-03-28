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
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  createHref?: string
  createLabel?: string
  createIcon?: LucideIcon
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  createHref,
  createLabel = 'Create',
  createIcon: CreateIcon,
  actions,
}: PageHeaderProps) {
  // Build full crumb trail: parents + current page title as last item
  const allCrumbs: BreadcrumbItem[] = []

  if (breadcrumbs) {
    // Add parent crumbs (exclude last if it matches title)
    for (let i = 0; i < breadcrumbs.length; i++) {
      const isLast = i === breadcrumbs.length - 1
      if (isLast && breadcrumbs[i].label === title) continue
      allCrumbs.push(breadcrumbs[i])
    }
  }

  // Always add current page as the final breadcrumb (no link)
  allCrumbs.push({ label: title })

  return (
    <div className="mb-4">
      {/* Breadcrumb bar with title integrated */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[13px]">
            {allCrumbs.map((crumb, i) => {
              const isLast = i === allCrumbs.length - 1
              return (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
                  {isLast ? (
                    <h1 className="text-[13px] font-semibold text-foreground">
                      {crumb.label}
                    </h1>
                  ) : crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{crumb.label}</span>
                  )}
                </span>
              )
            })}
          </nav>
          {description && (
            <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {createHref && (
            <Button asChild size="sm" className="h-9 rounded-lg px-4 gap-1.5 shadow-sm font-semibold text-[13px]">
              <Link href={createHref}>
                {CreateIcon && <CreateIcon className="h-4 w-4" />}
                {createLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
