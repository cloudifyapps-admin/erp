import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  current_tenant_id: number | null;
  profile_photo_path: string | null;
}

interface TenantInfo {
  id: number;
  name: string;
  role: string;
  is_owner: boolean;
  is_current: boolean;
}

interface AuthState {
  user: User | null;
  tenant: any | null;
  tenants: TenantInfo[];
  permissions: string[];
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName?: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  fetchTenants: () => Promise<void>;
  switchTenant: (tenantId: number) => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tenant: null,
  tenants: [],
  permissions: [],
  role: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    set({ isAuthenticated: true });
    await get().fetchMe();
    await get().fetchTenants();
  },

  register: async (name, email, password, companyName) => {
    const res = await api.post('/auth/register', { name, email, password, company_name: companyName });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    set({ isAuthenticated: true });
    await get().fetchMe();
    await get().fetchTenants();
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, tenant: null, tenants: [], permissions: [], role: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      set({
        user: res.data.user,
        tenant: res.data.tenant,
        permissions: res.data.permissions,
        role: res.data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  fetchTenants: async () => {
    try {
      const res = await api.get('/auth/my-tenants');
      set({ tenants: res.data });
    } catch {
      set({ tenants: [] });
    }
  },

  switchTenant: async (tenantId: number) => {
    try {
      await api.post('/auth/switch-tenant', { tenant_id: tenantId });
      // Re-fetch user data for the new tenant context
      await get().fetchMe();
      await get().fetchTenants();
      // Reload the page to reset all cached data
      window.location.href = '/';
    } catch {
      throw new Error('Failed to switch organization');
    }
  },

  hasPermission: (resource, action) => {
    const { permissions, tenant } = get();
    if (tenant?.is_owner) return true;
    const slug = `${resource}:${action}`;
    if (permissions.includes(slug)) return true;
    if (action === 'view' && permissions.includes(`${resource}:view-own`)) return true;
    if (action === 'edit' && permissions.includes(`${resource}:edit-own`)) return true;
    return false;
  },
}));
