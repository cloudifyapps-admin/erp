import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
  }
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-[0.8rem] font-semibold text-muted-foreground">
            {title}
          </CardTitle>
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-[1.5rem] font-bold text-foreground tabular-nums">{value}</div>
        {description && (
          <p className="mt-1 text-[0.75rem] text-muted-foreground">{description}</p>
        )}
        {trend !== undefined && (
          <p
            className={cn(
              'mt-1 text-[0.75rem] font-semibold',
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}%{trend.label ? ` ${trend.label}` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
