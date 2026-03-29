'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
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
  ListTodo,
  LayoutTemplate,
  PieChart,
  Briefcase,
  UsersRound,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Navigation data — grouped by category like the Spherule reference
// ---------------------------------------------------------------------------

const navGroups: NavGroup[] = [
  {
    category: 'MAIN',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    category: 'CRM',
    items: [
      { label: 'Dashboard', href: '/crm/dashboard', icon: BarChart3 },
      { label: 'Leads', href: '/crm/leads', icon: TrendingUp },
      { label: 'Contacts', href: '/crm/contacts', icon: UserCircle },
      { label: 'Customers', href: '/crm/customers', icon: Users },
      { label: 'Opportunities', href: '/crm/opportunities', icon: TrendingUp },
      { label: 'Activities', href: '/crm/activities', icon: CalendarDays },
      { label: 'Campaigns', href: '/crm/campaigns', icon: Flag },
      { label: 'Reports', href: '/crm/reports', icon: FileText },
    ],
  },
  {
    category: 'SALES',
    items: [
      { label: 'Quotations', href: '/sales/quotations', icon: FileText },
      { label: 'Sales Orders', href: '/sales/sales-orders', icon: ShoppingCart },
      { label: 'Deliveries', href: '/sales/deliveries', icon: Truck },
      { label: 'Invoices', href: '/sales/invoices', icon: Receipt },
    ],
  },
  {
    category: 'PURCHASE',
    items: [
      { label: 'Vendors', href: '/purchase/vendors', icon: Building2 },
      { label: 'Purchase Requests', href: '/purchase/purchase-requests', icon: ClipboardList },
      { label: 'Purchase Orders', href: '/purchase/purchase-orders', icon: PackageCheck },
      { label: 'Goods Receipts', href: '/purchase/goods-receipts', icon: Package },
    ],
  },
  {
    category: 'INVENTORY',
    items: [
      { label: 'Products', href: '/inventory/products', icon: Package },
      { label: 'Warehouses', href: '/inventory/warehouses', icon: Warehouse },
      { label: 'Stock Levels', href: '/inventory/stock-levels', icon: BarChart3 },
      { label: 'Stock Movements', href: '/inventory/stock-movements', icon: ArrowLeftRight },
      { label: 'Adjustments', href: '/inventory/stock-adjustments', icon: SlidersHorizontal },
      { label: 'Transfers', href: '/inventory/stock-transfers', icon: Truck },
    ],
  },
  {
    category: 'PROJECTS',
    items: [
      { label: 'Dashboard', href: '/projects/dashboard', icon: LayoutDashboard },
      { label: 'All Projects', href: '/projects', icon: FolderKanban },
      { label: 'My Tasks', href: '/projects/my-tasks', icon: ListTodo },
      { label: 'Tasks', href: '/projects/tasks', icon: CheckSquare },
      { label: 'Milestones', href: '/projects/milestones', icon: Flag },
      { label: 'Time Logs', href: '/projects/time-logs', icon: Clock },
      { label: 'Portfolio', href: '/projects/portfolio', icon: Briefcase },
      { label: 'Analytics', href: '/projects/analytics', icon: PieChart },
      { label: 'Templates', href: '/projects/templates', icon: LayoutTemplate },
      { label: 'Resources', href: '/projects/resource-planner', icon: UsersRound },
    ],
  },
  {
    category: 'HR & PEOPLE',
    items: [
      { label: 'Employees', href: '/hr/employees', icon: Users },
      { label: 'Departments', href: '/hr/departments', icon: Building },
      { label: 'Attendance', href: '/hr/attendance', icon: UserCog },
      { label: 'Leave Requests', href: '/hr/leave-requests', icon: CalendarOff },
      { label: 'Holidays', href: '/hr/holiday-lists', icon: CalendarCheck },
      { label: 'Payroll', href: '/hr/payroll', icon: DollarSign },
      { label: 'Reviews', href: '/hr/performance-reviews', icon: Star },
      { label: 'Expenses', href: '/hr/expense-claims', icon: CreditCard },
    ],
  },
  {
    category: 'OTHER',
    items: [
      { label: 'Documents', href: '/documents', icon: Folder },
      { label: 'Tickets', href: '/tickets', icon: Ticket },
    ],
  },
  {
    category: 'TEAM',
    items: [
      { label: 'Team Members', href: '/settings/team-members', icon: Users2 },
      { label: 'Roles & Permissions', href: '/settings/team-roles', icon: Shield },
    ],
  },
  {
    category: 'SETUP',
    items: [
      { label: 'Organization', href: '/settings/organization', icon: Building2 },
      { label: 'Master Data', href: '/settings/master-data', icon: Folder },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border/60 bg-sidebar transition-all duration-300 shrink-0',
        isOpen ? 'w-[248px]' : 'w-[68px]'
      )}
    >
      {/* ---- Logo / Brand ---- */}
      <div className={cn(
        'flex h-[60px] shrink-0 items-center border-b border-border/40',
        isOpen ? 'px-5 gap-3' : 'justify-center px-0'
      )}>
        {isOpen ? (
          <img src="/logo.png" alt="Cloudifyapps ERP" className="h-9 object-contain" />
        ) : (
          <img src="/icon.png" alt="Cloudifyapps" className="size-8 object-contain shrink-0" />
        )}
      </div>

      {/* ---- Navigation ---- */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <nav className={cn(
          'flex flex-col gap-0.5 py-4',
          isOpen ? 'px-3' : 'px-2'
        )}>
          {navGroups.map((group) => (
            <div key={group.category} className="mt-4 first:mt-0">
              {/* Category header — hidden in collapsed mode */}
              {group.category !== 'MAIN' && isOpen && (
                <p className="mb-1.5 px-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                  {group.category}
                </p>
              )}

              {/* Divider for collapsed mode between groups */}
              {group.category !== 'MAIN' && !isOpen && (
                <div className="mb-2 mt-1 mx-2 border-t border-border/40" />
              )}

              {/* Items */}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isExact = pathname === item.href;
                  const isNested = pathname.startsWith(item.href + '/');
                  // If another sibling nav item would also match via prefix,
                  // prefer the more specific one (longer href). This prevents
                  // "/projects" highlighting when on "/projects/dashboard".
                  const hasSiblingMatch = isNested && group.items.some(
                    (sibling) => sibling.href !== item.href && (pathname === sibling.href || pathname.startsWith(sibling.href + '/'))
                  );
                  const active = item.href === '/' ? isExact : (isExact || (isNested && !hasSiblingMatch));

                  // Collapsed: icon-only with tooltip
                  if (!isOpen) {
                    return (
                      <Tooltip key={item.href} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              'group flex items-center justify-center rounded-lg p-2 transition-all duration-150 cursor-pointer',
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            <Icon
                              className={cn(
                                'size-[18px] shrink-0 transition-colors',
                                active
                                  ? 'text-primary-foreground'
                                  : 'text-muted-foreground/70 group-hover:text-accent-foreground'
                              )}
                            />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  // Expanded: full label
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[0.8rem] font-medium transition-all duration-150 cursor-pointer',
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground/65 hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-[16px] shrink-0 transition-colors',
                          active
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground/70 group-hover:text-accent-foreground'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* ---- Footer ---- */}
      <div className={cn(
        'shrink-0 border-t border-border/40 py-3',
        isOpen ? 'px-5' : 'px-2 flex justify-center'
      )}>
        {isOpen ? (
          <p className="text-[11px] text-muted-foreground/50">
            Powered by <span className="font-medium text-muted-foreground/70">Cloudifyapps</span>
          </p>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex size-8 items-center justify-center rounded-lg cursor-default">
                <img src="/icon.png" alt="Cloudifyapps" className="size-5 object-contain opacity-50" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Cloudifyapps ERP
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
