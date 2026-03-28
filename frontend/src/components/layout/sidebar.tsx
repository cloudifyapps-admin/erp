'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserCircle,
  TrendingUp,
  CalendarDays,
  FileText,
  ShoppingCart,
  Truck,
  Receipt,
  Building2,
  ClipboardList,
  PackageCheck,
  Package,
  Warehouse,
  BarChart3,
  ArrowLeftRight,
  SlidersHorizontal,
  FolderKanban,
  CheckSquare,
  Flag,
  Clock,
  Briefcase,
  Building,
  UserCog,
  CalendarOff,
  CalendarCheck,
  DollarSign,
  Star,
  CreditCard,
  Folder,
  Ticket,
  Settings,
  Users2,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'CRM',
    icon: UserCheck,
    items: [
      { label: 'Leads', href: '/crm/leads', icon: TrendingUp },
      { label: 'Contacts', href: '/crm/contacts', icon: UserCircle },
      { label: 'Customers', href: '/crm/customers', icon: Users },
      { label: 'Opportunities', href: '/crm/opportunities', icon: TrendingUp },
      { label: 'Activities', href: '/crm/activities', icon: CalendarDays },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    items: [
      { label: 'Quotations', href: '/sales/quotations', icon: FileText },
      { label: 'Sales Orders', href: '/sales/sales-orders', icon: ShoppingCart },
      { label: 'Deliveries', href: '/sales/deliveries', icon: Truck },
      { label: 'Invoices', href: '/sales/invoices', icon: Receipt },
    ],
  },
  {
    label: 'Purchase',
    icon: ClipboardList,
    items: [
      { label: 'Vendors', href: '/purchase/vendors', icon: Building2 },
      { label: 'Purchase Requests', href: '/purchase/purchase-requests', icon: ClipboardList },
      { label: 'Purchase Orders', href: '/purchase/purchase-orders', icon: PackageCheck },
      { label: 'Goods Receipts', href: '/purchase/goods-receipts', icon: Package },
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    items: [
      { label: 'Products', href: '/inventory/products', icon: Package },
      { label: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse },
      { label: 'Stock Levels', href: '/inventory/stock-levels', icon: BarChart3 },
      { label: 'Stock Movements', href: '/inventory/stock-movements', icon: ArrowLeftRight },
      { label: 'Stock Adjustments', href: '/inventory/stock-adjustments', icon: SlidersHorizontal },
      { label: 'Stock Transfers', href: '/inventory/stock-transfers', icon: Truck },
    ],
  },
  {
    label: 'Projects',
    icon: FolderKanban,
    items: [
      { label: 'All Projects', href: '/projects', icon: FolderKanban },
      { label: 'Tasks', href: '/projects/tasks', icon: CheckSquare },
      { label: 'Milestones', href: '/projects/milestones', icon: Flag },
      { label: 'Time Logs', href: '/projects/time-logs', icon: Clock },
    ],
  },
  {
    label: 'HR',
    icon: Briefcase,
    items: [
      { label: 'Employees', href: '/hr/employees', icon: Users },
      { label: 'Departments', href: '/hr/departments', icon: Building },
      { label: 'Attendance', href: '/hr/attendance', icon: UserCog },
      { label: 'Leave Requests', href: '/hr/leave-requests', icon: CalendarOff },
      { label: 'Holiday Lists', href: '/hr/holiday-lists', icon: CalendarCheck },
      { label: 'Payroll', href: '/hr/payroll', icon: DollarSign },
      { label: 'Performance Reviews', href: '/hr/performance-reviews', icon: Star },
      { label: 'Expense Claims', href: '/hr/expense-claims', icon: CreditCard },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'Organization', href: '/settings/organization', icon: Building2 },
      { label: 'Master Data', href: '/settings/master-data', icon: Folder },
      { label: 'Team Members', href: '/settings/team-members', icon: Users2 },
      { label: 'Team Roles', href: '/settings/team-roles', icon: Shield },
    ],
  },
];

const topLevelItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Documents', href: '/documents', icon: Folder },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
];

function SidebarSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  const isActive = section.items.some((item) => pathname.startsWith(item.href));
  const [open, setOpen] = useState(isActive);
  const SectionIcon = section.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'text-slate-300 hover:bg-slate-800 hover:text-white',
          isActive && 'text-white'
        )}
      >
        <SectionIcon className="size-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-left">{section.label}</span>
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="mt-0.5 ml-3 border-l border-slate-700/60 pl-3">
          {section.items.map((item) => {
            const ItemIcon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                <ItemIcon className={cn('size-3.5 shrink-0', active ? 'text-blue-400' : 'text-slate-500')} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex h-screen flex-col bg-slate-900 transition-all duration-300',
        isOpen ? 'w-64' : 'w-0 overflow-hidden'
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-700/60 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-blue-600 text-white">
          <LayoutDashboard className="size-4" />
        </div>
        <span className="text-sm font-semibold text-white leading-tight">
          Cloudifyapps ERP
        </span>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 overflow-hidden">
        <nav className="flex flex-col gap-1 p-3">
          {/* Top-level items */}
          {topLevelItems.slice(0, 1).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <Separator className="my-1 bg-slate-700/60" />

          {/* Sections */}
          {navSections.map((section) => (
            <SidebarSection key={section.label} section={section} pathname={pathname} />
          ))}

          <Separator className="my-1 bg-slate-700/60" />

          {/* Documents & Tickets */}
          {topLevelItems.slice(1).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer hint */}
      <div className="shrink-0 border-t border-slate-700/60 p-3">
        <p className="text-center text-xs text-slate-600">v1.0.0</p>
      </div>
    </aside>
  );
}
