'use client';

import { useEffect } from 'react';
import {
  Menu,
  Search,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Bell,
  HelpCircle,
  MessageSquare,
  Building2,
  Check,
  Crown,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TopNavProps {
  onMenuToggle: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function TopNav({ onMenuToggle }: TopNavProps) {
  const { user, tenant, tenants, role, logout, fetchTenants, switchTenant } = useAuthStore();

  // Fetch tenants on mount
  useEffect(() => {
    if (tenants.length === 0) fetchTenants();
  }, []);

  const handleSwitchTenant = async (tenantId: number) => {
    if (tenant?.id === tenantId) return;
    try {
      await switchTenant(tenantId);
    } catch {
      toast.error('Failed to switch organization');
    }
  };

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border/60 bg-card px-5">
      {/* Hamburger */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onMenuToggle}
        aria-label="Toggle sidebar"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Menu className="size-[18px]" />
      </Button>

      {/* Org Switcher */}
      {tenants.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-muted/50 focus:outline-none">
              <Building2 className="size-3.5 text-muted-foreground/70" />
              <span className="max-w-[160px] truncate">{tenant?.name ?? 'Organization'}</span>
              <ChevronDown className="size-3 text-muted-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground font-medium">
              Switch Organization
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tenants.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => handleSwitchTenant(t.id)}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <div className={cn(
                  'size-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold',
                  t.is_current
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{t.name}</span>
                    {t.is_owner && <Crown className="size-3 text-amber-500 shrink-0" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground capitalize">{t.role}</span>
                </div>
                {t.is_current && <Check className="size-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : tenant ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-[13px] font-medium text-foreground/80">
          <Building2 className="size-3.5 text-muted-foreground/70" />
          <span className="max-w-[160px] truncate">{tenant.name}</span>
        </div>
      ) : null}

      {/* Search */}
      <div className="relative ml-2 flex-1 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          placeholder="Search anything..."
          className="h-10 rounded-xl border-border/40 bg-muted/30 pl-10 text-[13px] placeholder:text-muted-foreground/40 focus-visible:bg-background focus-visible:border-primary/30 transition-colors"
        />
      </div>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-1">
        {/* Notification bell */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Bell className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        {/* Help */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Help & Support</TooltipContent>
        </Tooltip>

        {/* Messages */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Messages</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1.5 h-6" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent focus:outline-none">
              <Avatar size="sm">
                <AvatarImage
                  src={user?.profile_photo_path ?? undefined}
                  alt={user?.name ?? 'User'}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2.5">
                <Avatar size="default">
                  <AvatarImage
                    src={user?.profile_photo_path ?? undefined}
                    alt={user?.name ?? 'User'}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user?.name ?? 'User'}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  {role && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 capitalize">
                      {role}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Tenant switcher in user menu (for quick access) */}
            {tenants.length > 1 && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <ArrowLeftRight className="size-4" />
                    Switch Organization
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {tenants.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => handleSwitchTenant(t.id)}
                        className="flex items-center gap-2.5 py-2 cursor-pointer"
                      >
                        <div className={cn(
                          'size-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold',
                          t.is_current
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate text-[13px]">{t.name}</span>
                        {t.is_current && <Check className="size-3.5 text-primary shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem>
              <User className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={logout}
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
