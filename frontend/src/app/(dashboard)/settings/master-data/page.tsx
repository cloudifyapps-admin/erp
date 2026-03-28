'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import {
  CalendarOff,
  FolderTree,
  Award,
  Tag,
  CheckCircle2,
  AlertTriangle,
  FileBox,
  Ruler,
  Globe,
  Receipt,
  Megaphone,
  BarChart3,
  Layers,
  Activity,
  ListChecks,
  UserCircle,
} from 'lucide-react';

const MASTER_DATA_TYPES = [
  { value: 'leave-types', label: 'Leave Types', description: 'Types of leave employees can request', icon: CalendarOff, color: 'bg-blue-500/10 text-blue-600' },
  { value: 'product-categories', label: 'Product Categories', description: 'Organize products into categories', icon: FolderTree, color: 'bg-emerald-500/10 text-emerald-600' },
  { value: 'product-brands', label: 'Product Brands', description: 'Manage product brand names', icon: Award, color: 'bg-purple-500/10 text-purple-600' },
  { value: 'ticket-categories', label: 'Ticket Categories', description: 'Categorize support tickets', icon: Tag, color: 'bg-amber-500/10 text-amber-600' },
  { value: 'ticket-statuses', label: 'Ticket Statuses', description: 'Define ticket workflow statuses', icon: CheckCircle2, color: 'bg-green-500/10 text-green-600' },
  { value: 'ticket-priorities', label: 'Ticket Priorities', description: 'Set priority levels for tickets', icon: AlertTriangle, color: 'bg-red-500/10 text-red-600' },
  { value: 'document-categories', label: 'Document Categories', description: 'Organize documents by category', icon: FileBox, color: 'bg-indigo-500/10 text-indigo-600' },
  { value: 'units-of-measure', label: 'Units of Measure', description: 'Define measurement units for products', icon: Ruler, color: 'bg-teal-500/10 text-teal-600' },
  { value: 'tax-regions', label: 'Tax Regions', description: 'Configure tax regions and zones', icon: Globe, color: 'bg-cyan-500/10 text-cyan-600' },
  { value: 'tax-types', label: 'Tax Types', description: 'Define different tax types', icon: Receipt, color: 'bg-orange-500/10 text-orange-600' },
  { value: 'lead-sources', label: 'Lead Sources', description: 'Track where leads originate from', icon: Megaphone, color: 'bg-pink-500/10 text-pink-600' },
  { value: 'lead-statuses', label: 'Lead Statuses', description: 'Define lead pipeline statuses', icon: BarChart3, color: 'bg-violet-500/10 text-violet-600' },
  { value: 'opportunity-stages', label: 'Opportunity Stages', description: 'Sales opportunity pipeline stages', icon: Layers, color: 'bg-sky-500/10 text-sky-600' },
  { value: 'activity-types', label: 'Activity Types', description: 'Types of CRM activities', icon: Activity, color: 'bg-rose-500/10 text-rose-600' },
  { value: 'task-statuses', label: 'Task Statuses', description: 'Define project task statuses', icon: ListChecks, color: 'bg-lime-500/10 text-lime-600' },
  { value: 'salutations', label: 'Salutations', description: 'Manage contact salutations', icon: UserCircle, color: 'bg-slate-500/10 text-slate-600' },
];

export default function MasterDataPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Master Data"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Master Data' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MASTER_DATA_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <Link
              key={type.value}
              href={`/settings/master-data/${type.value}`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${type.color}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {type.label}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {type.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
