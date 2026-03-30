'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  TrendingUp,
  ShoppingCart,
  FolderKanban,
  Briefcase,
  Ticket,
  Plus,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  total_customers: number;
  active_leads: number;
  open_orders: number;
  active_projects: number;
  employees: number;
  open_tickets: number;
}

interface Lead {
  id: number;
  title: string;
  contact_name: string;
  status: string;
  value: number | null;
  created_at: string;
}

interface SalesOrder {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  total: number;
  created_at: string;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchStats(): Promise<DashboardStats> {
  const res = await api.get('/dashboard/stats');
  return res.data;
}

async function fetchRecentLeads(): Promise<Lead[]> {
  const res = await api.get('/crm/leads', { params: { per_page: 5, sort: '-created_at' } });
  return res.data.data ?? res.data;
}

async function fetchRecentOrders(): Promise<SalesOrder[]> {
  const res = await api.get('/sales/sales-orders', { params: { per_page: 5, sort: '-created_at' } });
  return res.data.data ?? res.data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

function StatCard({ label, value, icon: Icon, href, color }: StatCardProps) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all hover:shadow-md hover:border-border/80 group">
        <CardContent className="flex items-center gap-4 py-5 px-5">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[1.5rem] font-bold leading-tight tabular-nums text-foreground">
              {value === undefined ? (
                <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted" />
              ) : (
                value.toLocaleString()
              )}
            </p>
            <p className="text-[0.8rem] font-medium text-muted-foreground mt-0.5">{label}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}

function leadStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'new':
      return 'default';
    case 'contacted':
    case 'qualified':
      return 'secondary';
    case 'lost':
      return 'destructive';
    default:
      return 'outline';
  }
}

function orderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'confirmed':
    case 'delivered':
      return 'default';
    case 'draft':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchStats,
    retry: false,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['recent-leads'],
    queryFn: fetchRecentLeads,
    retry: false,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: fetchRecentOrders,
    retry: false,
  });

  const statCards: StatCardProps[] = [
    {
      label: 'Total Customers',
      value: stats?.total_customers,
      icon: Users,
      href: '/crm/customers',
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      label: 'Active Leads',
      value: stats?.active_leads,
      icon: TrendingUp,
      href: '/crm/leads',
      color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    },
    {
      label: 'Open Orders',
      value: stats?.open_orders,
      icon: ShoppingCart,
      href: '/sales/orders',
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    },
    {
      label: 'Active Projects',
      value: stats?.active_projects,
      icon: FolderKanban,
      href: '/projects',
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    },
    {
      label: 'Employees',
      value: stats?.employees,
      icon: Briefcase,
      href: '/hr/employees',
      color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    },
    {
      label: 'Open Tickets',
      value: stats?.open_tickets,
      icon: Ticket,
      href: '/tickets',
      color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    },
  ];

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-foreground leading-tight">
          {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        </h1>
        <p className="text-[13px] font-medium text-muted-foreground">
          {new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Tables row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>Latest 5 leads in the pipeline</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/crm/leads">
                View all <ExternalLink className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {leadsLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : !leads?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {leads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-semibold text-foreground">{lead.title}</p>
                      <p className="truncate text-[0.75rem] text-muted-foreground mt-0.5">{lead.contact_name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant={leadStatusVariant(lead.status)} className="capitalize text-[0.68rem]">
                        {lead.status}
                      </Badge>
                      <span className="text-[0.7rem] text-muted-foreground">{formatDate(lead.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <CardTitle>Recent Sales Orders</CardTitle>
              <CardDescription>Latest 5 orders</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sales/orders">
                View all <ExternalLink className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {ordersLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : !orders?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-semibold text-foreground">{order.order_number}</p>
                      <p className="truncate text-[0.75rem] text-muted-foreground mt-0.5">{order.customer_name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant={orderStatusVariant(order.status)} className="capitalize text-[0.68rem]">
                        {order.status}
                      </Badge>
                      <span className="text-[0.75rem] font-semibold tabular-nums text-foreground">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get things done fast</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/crm/leads?action=new">
                <Plus className="mr-1 size-3.5" /> New Lead
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/sales/orders?action=new">
                <Plus className="mr-1 size-3.5" /> New Sales Order
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/purchase/requests?action=new">
                <Plus className="mr-1 size-3.5" /> Purchase Request
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/projects?action=new">
                <Plus className="mr-1 size-3.5" /> New Project
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/hr/employees?action=new">
                <Plus className="mr-1 size-3.5" /> Add Employee
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/tickets?action=new">
                <Plus className="mr-1 size-3.5" /> Open Ticket
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
