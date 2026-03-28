'use client';

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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const { user, role, logout } = useAuthStore();

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
