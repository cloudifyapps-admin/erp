'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Pencil,
  ArrowRightCircle,
  Mail,
  Phone,
  Building2,
  Globe,
  MapPin,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AuditTimeline } from '@/components/shared/audit-timeline'

interface Lead {
  id: number
  code: string
  title: string
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  company: string
  job_title: string
  source: string
  status: string
  notes: string
  website: string
  industry: string
  annual_revenue: number | null
  number_of_employees: number | null
  lead_score: number
  converted_at: string | null
  next_follow_up_at: string | null
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  country: string
  custom_fields: Record<string, string> | null
  created_at: string
  updated_at: string
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-3 border-b border-border/30 last:border-b-0">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px]">{value}</span>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  qualified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  converted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  rejected: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get(`/crm/leads/${id}`)
      .then(({ data }) => setLead(data))
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!lead) {
    return <div className="py-20 text-center text-muted-foreground">Lead not found.</div>
  }

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ')
  const address = [lead.address_line1, lead.address_line2, lead.city, lead.state, lead.zip_code, lead.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={lead.code || fullName}
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Leads', href: '/crm/leads' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {lead.lead_score > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                  lead.lead_score >= 60
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : lead.lead_score >= 30
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Score: {lead.lead_score}
              </span>
            )}
            {lead.converted_at ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Converted {new Date(lead.converted_at).toLocaleDateString()}
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-4 text-[13px] gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => router.push(`/crm/leads/${id}/convert`)}
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Convert Lead
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg px-4 text-[13px] gap-1.5"
              onClick={() => router.push(`/crm/leads/${id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <Tabs defaultValue="details" className="gap-0">
          <div className="border-b border-border/40 bg-muted/30 px-6">
            <TabsList variant="line" className="!h-auto gap-2">
              <TabsTrigger value="details" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                Details
              </TabsTrigger>
              <TabsTrigger value="additional" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                Additional
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2.5 px-5 py-3.5 text-[14px] cursor-pointer data-active:font-semibold">
                <Clock className="h-[18px] w-[18px]" />
                Timeline
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="p-6 lg:px-8 lg:py-2">
            <Field label="Name" value={fullName} />
            <Field label="Title / Reference" value={lead.title} />
            <Field
              label="Status"
              value={
                <Badge variant="secondary" className={`text-[11px] ${STATUS_COLORS[lead.status] ?? ''}`}>
                  {lead.status}
                </Badge>
              }
            />
            <Field label="Email" value={lead.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {lead.email}
              </span>
            )} />
            <Field label="Phone" value={lead.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {lead.phone}
              </span>
            )} />
            <Field label="Mobile" value={lead.mobile} />
            <Field label="Company" value={lead.company && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {lead.company}
              </span>
            )} />
            <Field label="Job Title" value={lead.job_title} />
            <Field label="Source" value={lead.source} />
            <Field label="Next Follow Up" value={lead.next_follow_up_at && new Date(lead.next_follow_up_at).toLocaleString()} />
          </TabsContent>

          <TabsContent value="additional" className="p-6 lg:px-8 lg:py-2">
            <Field label="Website" value={lead.website && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                {lead.website}
              </span>
            )} />
            <Field label="Industry" value={lead.industry} />
            <Field label="Annual Revenue" value={lead.annual_revenue != null ? `$${lead.annual_revenue.toLocaleString()}` : null} />
            <Field label="No. of Employees" value={lead.number_of_employees} />
            <Field label="Address" value={address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {address}
              </span>
            )} />
            {lead.notes && <Field label="Notes" value={<p className="whitespace-pre-wrap">{lead.notes}</p>} />}
            {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
              <>
                <div className="pt-4 pb-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Custom Fields</p>
                </div>
                {Object.entries(lead.custom_fields).map(([key, value]) => (
                  <Field key={key} label={key} value={value} />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="p-6 lg:p-8">
            <AuditTimeline entityType="leads" entityId={parseInt(id)} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
