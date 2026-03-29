'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
import { normalizePaginated } from '@/lib/api-helpers'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

interface BudgetCategory { id: string; category: string; planned: number; actual: number }
interface Expense {
  id: string; description: string; amount: number; category: string
  submitted_by: string; submitted_at: string; status: string; receipt_url: string
}
interface Milestone {
  id: string; title: string; billing_amount: number; billing_status: string
}
interface Project {
  id: string; name: string; budget: number; actual_cost: number; currency: string
  billable_hours: number; billing_rate: number
}

function formatCurrency(amount: number, currency: string = '$') {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/50">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-[14px] font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-[12px] text-muted-foreground/60">{description}</p>
    </div>
  )
}

function BudgetChart({ categories, currency }: { categories: BudgetCategory[]; currency: string }) {
  const maxValue = Math.max(...categories.flatMap((c) => [c.planned, c.actual]), 1)
  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => {
        const variance = cat.actual - cat.planned
        const isOver = variance > 0
        return (
          <div key={cat.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium">{cat.category}</span>
              <span className={`text-[11px] font-semibold tabular-nums ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                {isOver ? '+' : ''}{formatCurrency(variance, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12">Planned</span>
                <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                  <div className="h-full bg-primary/60 rounded" style={{ width: `${(cat.planned / maxValue) * 100}%` }} />
                </div>
                <span className="text-[10px] tabular-nums w-20 text-right">{formatCurrency(cat.planned, currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12">Actual</span>
                <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                  <div className={`h-full rounded ${isOver ? 'bg-red-500/70' : 'bg-green-500/70'}`} style={{ width: `${(cat.actual / maxValue) * 100}%` }} />
                </div>
                <span className="text-[10px] tabular-nums w-20 text-right">{formatCurrency(cat.actual, currency)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function FinancePage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [project, setProject] = useState<Project | null>(null)
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [financeSubTab, setFinanceSubTab] = useState('budget')

  const fetchProject = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}`); setProject(data) }
    catch { toast.error('Failed to load project') } finally { setLoading(false) }
  }, [projectId])

  const fetchBudget = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/budget`)
      setBudgetCategories(Array.isArray(data) ? data : (data.categories ?? []))
    } catch {}
  }, [projectId])

  const fetchExpenses = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/expenses`, { params: { page_size: 100 } })
      setExpenses(normalizePaginated<Expense>(data).items)
    } catch {}
  }, [projectId])

  const fetchMilestones = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${projectId}/milestones`, { params: { page_size: 100 } })
      setMilestones(normalizePaginated<Milestone>(data).items)
    } catch {}
  }, [projectId])

  useEffect(() => { fetchProject(); fetchBudget(); fetchExpenses(); fetchMilestones() }, [fetchProject, fetchBudget, fetchExpenses, fetchMilestones])

  const handleApproveExpense = async (expId: string) => {
    try {
      await api.patch(`/projects/${projectId}/expenses/${expId}`, { status: 'approved' })
      toast.success('Expense approved'); fetchExpenses()
    } catch { toast.error('Failed to approve expense') }
  }

  if (loading) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  const totalBudget = project?.budget ?? 0
  const totalActual = project?.actual_cost ?? budgetCategories.reduce((sum, c) => sum + c.actual, 0)
  const profitability = totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : 0
  const currency = project?.currency ?? '$'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Finance"
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project?.name ?? 'Project', href: `/projects/${projectId}` },
        ]}
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm p-6">
        <div className="flex items-center gap-1 mb-6 border-b border-border/30 pb-3">
          {[
            { key: 'budget', label: 'Budget' },
            { key: 'expenses', label: 'Expenses' },
            { key: 'billing', label: 'Billing' },
            { key: 'profitability', label: 'Profitability' },
          ].map((st) => (
            <Button key={st.key} variant={financeSubTab === st.key ? 'secondary' : 'ghost'} size="sm" className="h-8 text-[12px]" onClick={() => setFinanceSubTab(st.key)}>
              {st.label}
            </Button>
          ))}
        </div>

        {financeSubTab === 'budget' && (
          <div className="max-w-3xl">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg border border-border/40 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Budget</p>
                <p className="text-[18px] font-bold mt-1">{formatCurrency(totalBudget, currency)}</p>
              </div>
              <div className="rounded-lg border border-border/40 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Actual Spend</p>
                <p className="text-[18px] font-bold mt-1">{formatCurrency(totalActual, currency)}</p>
              </div>
              <div className="rounded-lg border border-border/40 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Variance</p>
                <p className={`text-[18px] font-bold mt-1 ${totalActual > totalBudget ? 'text-red-600' : 'text-green-600'}`}>
                  {totalActual > totalBudget ? '+' : ''}{formatCurrency(totalActual - totalBudget, currency)}
                </p>
              </div>
            </div>
            {budgetCategories.length > 0 ? (
              <BudgetChart categories={budgetCategories} currency={currency} />
            ) : (
              <EmptyState icon={BarChart3} title="No budget data" description="Set up budget categories for cost tracking." />
            )}
          </div>
        )}

        {financeSubTab === 'expenses' && (
          <div>
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted By</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-16 text-muted-foreground text-[13px]">No expenses recorded.</td></tr>
                  )}
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5 font-medium">{exp.description}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{exp.category}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold">{formatCurrency(exp.amount, currency)}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{exp.submitted_by}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{exp.submitted_at ? format(new Date(exp.submitted_at), 'MMM d, yyyy') : '---'}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={exp.status} /></td>
                      <td className="px-4 py-3.5 text-right">
                        {exp.status === 'pending' && (
                          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => handleApproveExpense(exp.id)}>Approve</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {financeSubTab === 'billing' && (
          <div className="max-w-3xl">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg border border-border/40 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Billable Hours</p>
                <p className="text-[18px] font-bold mt-1">{(project?.billable_hours ?? 0).toFixed(1)}h</p>
              </div>
              <div className="rounded-lg border border-border/40 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Rate</p>
                <p className="text-[18px] font-bold mt-1">{formatCurrency(project?.billing_rate ?? 0, currency)}/hr</p>
              </div>
              <div className="rounded-lg border border-border/40 p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Billable Total</p>
                <p className="text-[18px] font-bold mt-1 text-green-600">
                  {formatCurrency((project?.billable_hours ?? 0) * (project?.billing_rate ?? 0), currency)}
                </p>
              </div>
            </div>
            {milestones.filter((m) => m.billing_amount > 0).length > 0 && (
              <div>
                <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Milestone Billing</h4>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Milestone</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.filter((m) => m.billing_amount > 0).map((m) => (
                        <tr key={m.id} className="border-b border-border/30 last:border-b-0">
                          <td className="px-4 py-3.5 font-medium">{m.title}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-semibold">{formatCurrency(m.billing_amount, currency)}</td>
                          <td className="px-4 py-3.5"><StatusBadge status={m.billing_status ?? 'pending'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {financeSubTab === 'profitability' && (
          <div className="max-w-2xl">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-lg border border-border/40 p-5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Revenue vs Cost</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">Revenue</span>
                    <span className="text-[14px] font-bold text-green-600">{formatCurrency(totalBudget, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">Cost</span>
                    <span className="text-[14px] font-bold text-red-600">{formatCurrency(totalActual, currency)}</span>
                  </div>
                  <div className="border-t border-border/30 pt-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium">Profit</span>
                    <span className={`text-[14px] font-bold ${totalBudget - totalActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(totalBudget - totalActual, currency)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border/40 p-5 flex flex-col items-center justify-center">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Profit Margin</p>
                <div className="relative size-28">
                  <svg viewBox="0 0 36 36" className="size-28 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                      strokeDasharray={`${Math.max(0, profitability)} ${100 - Math.max(0, profitability)}`}
                      strokeLinecap="round" className={profitability >= 0 ? 'text-green-500' : 'text-red-500'} stroke="currentColor"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-[18px] font-bold ${profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profitability.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  {profitability >= 0 ? <TrendingUp className="size-4 text-green-500" /> : <TrendingDown className="size-4 text-red-500" />}
                  <span className={profitability >= 0 ? 'text-green-600' : 'text-red-600'}>{profitability >= 0 ? 'Profitable' : 'Over Budget'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
