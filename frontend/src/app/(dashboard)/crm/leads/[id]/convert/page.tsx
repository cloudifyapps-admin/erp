'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2,
  UserPlus,
  Building2,
  Target,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

interface LeadData {
  id: number
  title: string
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  company: string
  job_title: string
  lead_score: number
  status: string
  source: string
  industry_id: number | null
  rating_id: number | null
  territory_id: number | null
  campaign_id: number | null
  converted_at: string | null
}

interface ConvertResult {
  lead: Record<string, unknown>
  contact: Record<string, unknown>
  customer: Record<string, unknown> | null
  opportunity: Record<string, unknown> | null
}

export default function ConvertLeadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<LeadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [result, setResult] = useState<ConvertResult | null>(null)

  // Conversion options
  const [createCustomer, setCreateCustomer] = useState(true)
  const [createOpportunity, setCreateOpportunity] = useState(true)

  // Opportunity overrides
  const [oppTitle, setOppTitle] = useState('')
  const [oppAmount, setOppAmount] = useState('')
  const [oppCloseDate, setOppCloseDate] = useState('')

  useEffect(() => {
    api
      .get(`/crm/leads/${id}`)
      .then(({ data }) => {
        setLead(data)
        setOppTitle(data.title || `${data.first_name} ${data.last_name} - Deal`)
        // Default close date 30 days from now
        const d = new Date()
        d.setDate(d.getDate() + 30)
        setOppCloseDate(d.toISOString().split('T')[0])
      })
      .catch(() => toast.error('Failed to load lead'))
      .finally(() => setLoading(false))
  }, [id])

  const handleConvert = async () => {
    if (!lead) return
    setConverting(true)
    try {
      const body: Record<string, unknown> = {}

      // Contact is always created (no overrides needed — uses lead data)
      body.contact = {}

      // Customer creation
      if (createCustomer) {
        body.customer = {}
      }

      // Opportunity creation
      if (createOpportunity) {
        body.create_opportunity = {
          title: oppTitle,
          ...(oppAmount && { expected_amount: parseFloat(oppAmount) }),
          ...(oppCloseDate && { expected_close_date: oppCloseDate }),
          stage: 'qualification',
          probability: 25,
        }
      }

      const { data } = await api.post(`/crm/leads/${id}/convert`, body)
      setResult(data)
      toast.success('Lead converted successfully!')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to convert lead'
      toast.error(detail)
    } finally {
      setConverting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    )
  }

  if (lead.converted_at) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Convert Lead"
          breadcrumbs={[
            { label: 'CRM' },
            { label: 'Leads', href: '/crm/leads' },
            { label: lead.title || `${lead.first_name} ${lead.last_name}` },
          ]}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Already Converted</h3>
          <p className="text-muted-foreground mb-6">
            This lead was already converted on{' '}
            {new Date(lead.converted_at).toLocaleDateString()}.
          </p>
          <Button variant="outline" onClick={() => router.push('/crm/leads')}>
            Back to Leads
          </Button>
        </div>
      </div>
    )
  }

  // Success state
  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Lead Converted"
          breadcrumbs={[
            { label: 'CRM' },
            { label: 'Leads', href: '/crm/leads' },
            { label: lead.title || `${lead.first_name} ${lead.last_name}` },
          ]}
        />
        <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Conversion Successful!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                The lead has been converted to the following records:
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Contact */}
            <button
              onClick={() =>
                router.push(
                  `/crm/contacts/${(result.contact as { id: number }).id}/edit`
                )
              }
              className="w-full flex items-center gap-4 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-green-950/30 p-4 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Contact Created</p>
                <p className="text-xs text-muted-foreground">
                  {lead.first_name} {lead.last_name}
                  {lead.email && ` — ${lead.email}`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Customer */}
            {result.customer && (
              <button
                onClick={() =>
                  router.push(
                    `/crm/customers/${(result.customer as { id: number }).id}/edit`
                  )
                }
                className="w-full flex items-center gap-4 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-green-950/30 p-4 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Customer Created</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.company || `${lead.first_name} ${lead.last_name}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            {/* Opportunity */}
            {result.opportunity && (
              <button
                onClick={() =>
                  router.push(
                    `/crm/opportunities/${(result.opportunity as { id: number }).id}/edit`
                  )
                }
                className="w-full flex items-center gap-4 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-green-950/30 p-4 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Opportunity Created</p>
                  <p className="text-xs text-muted-foreground">{oppTitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/crm/leads')}
            >
              Back to Leads
            </Button>
            <Button
              onClick={() =>
                router.push(
                  `/crm/contacts/${(result.contact as { id: number }).id}/edit`
                )
              }
            >
              View Contact
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const scoreColor =
    lead.lead_score >= 60
      ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      : lead.lead_score >= 30
        ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
        : 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400'

  const scoreLabel =
    lead.lead_score >= 60
      ? 'Hot'
      : lead.lead_score >= 30
        ? 'Warm'
        : 'Cold'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Convert Lead"
        breadcrumbs={[
          { label: 'CRM' },
          { label: 'Leads', href: '/crm/leads' },
          { label: lead.title || `${lead.first_name} ${lead.last_name}` },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left — Lead Summary */}
        <div className="space-y-4">
          {/* Lead Info Card */}
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold">
                  {lead.first_name} {lead.last_name}
                </h3>
                {lead.job_title && (
                  <p className="text-sm text-muted-foreground">{lead.job_title}</p>
                )}
                {lead.company && (
                  <p className="text-sm text-muted-foreground font-medium mt-0.5">
                    {lead.company}
                  </p>
                )}
              </div>
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${scoreColor}`}>
                <Sparkles className="h-3 w-3" />
                {lead.lead_score} — {scoreLabel}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p className="font-medium">{lead.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                <p className="font-medium">{lead.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Source</p>
                <p className="font-medium capitalize">
                  {lead.source?.replace(/[-_]/g, ' ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                <p className="font-medium capitalize">{lead.status}</p>
              </div>
            </div>
          </div>

          {/* Conversion Flow Visual */}
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
            <h4 className="text-sm font-semibold mb-4">Conversion Flow</h4>

            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-medium">Lead</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 border border-blue-200 dark:border-blue-800">
                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  Contact
                </span>
              </div>
              {createCustomer && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2 border border-violet-200 dark:border-violet-800">
                    <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                      <Building2 className="h-3.5 w-3.5 text-violet-600" />
                    </div>
                    <span className="font-medium text-violet-700 dark:text-violet-300">
                      Customer
                    </span>
                  </div>
                </>
              )}
              {createOpportunity && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <Target className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      Opportunity
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right — Conversion Options */}
        <div className="space-y-4">
          {/* Contact (always created) */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold">Create Contact</h4>
              <span className="ml-auto text-[11px] font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 rounded px-2 py-0.5">
                Always
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              A contact record will be created using the lead&apos;s details (
              {lead.first_name} {lead.last_name}).
            </p>
          </div>

          {/* Customer (optional) */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Checkbox
                id="create-customer"
                checked={createCustomer}
                onCheckedChange={(v) => setCreateCustomer(!!v)}
              />
              <Label
                htmlFor="create-customer"
                className="flex items-center gap-2 text-sm font-semibold cursor-pointer"
              >
                <Building2 className="h-4 w-4 text-violet-600" />
                Create Customer Account
              </Label>
            </div>
            {createCustomer && (
              <p className="text-xs text-muted-foreground ml-7">
                A {lead.company ? 'company' : 'individual'} customer account
                will be created
                {lead.company ? ` for "${lead.company}"` : ''} with an
                auto-generated code.
              </p>
            )}
          </div>

          {/* Opportunity (optional) */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Checkbox
                id="create-opportunity"
                checked={createOpportunity}
                onCheckedChange={(v) => setCreateOpportunity(!!v)}
              />
              <Label
                htmlFor="create-opportunity"
                className="flex items-center gap-2 text-sm font-semibold cursor-pointer"
              >
                <Target className="h-4 w-4 text-emerald-600" />
                Create Opportunity
              </Label>
            </div>
            {createOpportunity && (
              <div className="ml-7 space-y-3 mt-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Deal Title
                  </Label>
                  <Input
                    value={oppTitle}
                    onChange={(e) => setOppTitle(e.target.value)}
                    placeholder="Opportunity title"
                    className="h-9 mt-1 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Expected Amount
                    </Label>
                    <Input
                      type="number"
                      value={oppAmount}
                      onChange={(e) => setOppAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-9 mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Expected Close
                    </Label>
                    <Input
                      type="date"
                      value={oppCloseDate}
                      onChange={(e) => setOppCloseDate(e.target.value)}
                      className="h-9 mt-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Convert Button */}
          <Button
            className="w-full h-11 text-sm font-semibold shadow-sm"
            onClick={handleConvert}
            disabled={converting}
          >
            {converting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Convert Lead
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
