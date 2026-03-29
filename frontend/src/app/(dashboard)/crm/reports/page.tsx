'use client'

import Link from 'next/link'
import {
  BarChart3,
  Filter,
  Activity,
  TrendingUp,
  PieChart,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import type { LucideIcon } from 'lucide-react'

interface ReportCard {
  title: string
  description: string
  href: string
  icon: LucideIcon
}

const reports: ReportCard[] = [
  {
    title: 'Pipeline Report',
    description: 'Analyze your sales pipeline by stage with weighted values and deal size metrics.',
    href: '/crm/reports/pipeline',
    icon: BarChart3,
  },
  {
    title: 'Conversion Funnel',
    description: 'Track lead progression from new to converted with conversion and qualification rates.',
    href: '/crm/reports/conversion',
    icon: Filter,
  },
  {
    title: 'Activity Report',
    description: 'Monitor team activities by type and user, including overdue task tracking.',
    href: '/crm/reports/activity',
    icon: Activity,
  },
  {
    title: 'Sales Forecast',
    description: 'Project future revenue with expected vs weighted forecasts over the next 6 months.',
    href: '/crm/reports/forecast',
    icon: TrendingUp,
  },
  {
    title: 'Lead Source Analysis',
    description: 'Evaluate lead generation channels by volume and conversion effectiveness.',
    href: '/crm/reports/lead-source',
    icon: PieChart,
  },
]

export default function CrmReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CRM Reports"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Reports' },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <Link
              key={report.href}
              href={report.href}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 text-card-foreground ring-1 ring-foreground/10 transition-all hover:shadow-md hover:ring-foreground/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold leading-tight">
                  {report.title}
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {report.description}
              </p>
              <span className="mt-auto text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                View Report &rarr;
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
