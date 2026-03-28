'use client';

import { Menu, Search, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      {/* Hamburger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuToggle}
        aria-label="Toggle sidebar"
        className="shrink-0"
      >
        <Menu className="size-5" />
      </Button>

      {/* App name – visible on small screens when sidebar is hidden */}
      <span className="hidden text-sm font-semibold sm:block lg:hidden">
        Cloudifyapps ERP
      </span>

      {/* Search */}
      <div className="relative mx-2 flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search…"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted focus:outline-none">
              <Avatar size="sm">
                <AvatarImage
                  src={user?.profile_photo_path ?? undefined}
                  alt={user?.name ?? 'User'}
                />
                <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start md:flex">
                <span className="text-xs font-medium leading-tight">{user?.name ?? 'User'}</span>
                {role && (
                  <span className="text-xs text-muted-foreground capitalize leading-tight">{role}</span>
                )}
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{user?.name ?? 'User'}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
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
