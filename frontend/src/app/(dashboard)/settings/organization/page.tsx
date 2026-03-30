'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Building2, MapPin, Phone, Receipt, Settings2, Hash,
  Save, RotateCcw, TriangleAlert,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgSettings {
  name: string; legal_name: string; registration_number: string;
  industry: string; size: string; website: string; logo_url: string;
  address_line1: string; address_line2: string; city: string;
  state: string; country: string; postal_code: string;
  phone: string; email: string; support_email: string; fax: string;
  tax_id: string; vat_number: string; tax_year_start: string; tax_country: string;
  currency: string; timezone: string; date_format: string;
  fiscal_year_start: string; language: string;
  number_series: Record<string, NumberSeries>;
}

interface NumberSeries {
  prefix: string;
  padding: number;
  next_number: number;
}

const INITIAL: OrgSettings = {
  name: '', legal_name: '', registration_number: '', industry: '', size: '',
  website: '', logo_url: '', address_line1: '', address_line2: '', city: '',
  state: '', country: '', postal_code: '', phone: '', email: '', support_email: '',
  fax: '', tax_id: '', vat_number: '', tax_year_start: '', tax_country: '',
  currency: 'USD', timezone: 'UTC', date_format: 'MMM D, YYYY',
  fiscal_year_start: '01-01', language: 'en',
  number_series: {},
};

// ---------------------------------------------------------------------------
// Numbering series config — grouped by module
// ---------------------------------------------------------------------------

const SERIES_GROUPS: { label: string; entities: { key: string; label: string; defaultPrefix: string; defaultPadding: number }[] }[] = [
  {
    label: 'CRM',
    entities: [
      { key: 'lead', label: 'Lead', defaultPrefix: 'LD', defaultPadding: 5 },
      { key: 'contact', label: 'Contact', defaultPrefix: 'CON', defaultPadding: 5 },
      { key: 'customer', label: 'Customer', defaultPrefix: 'CUST', defaultPadding: 5 },
      { key: 'opportunity', label: 'Opportunity', defaultPrefix: 'OPP', defaultPadding: 5 },
      { key: 'campaign', label: 'Campaign', defaultPrefix: 'CAMP', defaultPadding: 4 },
    ],
  },
  {
    label: 'Sales',
    entities: [
      { key: 'quotation', label: 'Quotation', defaultPrefix: 'QUO', defaultPadding: 5 },
      { key: 'sales_order', label: 'Sales Order', defaultPrefix: 'SO', defaultPadding: 5 },
      { key: 'delivery', label: 'Delivery', defaultPrefix: 'DEL', defaultPadding: 5 },
      { key: 'invoice', label: 'Invoice', defaultPrefix: 'INV', defaultPadding: 5 },
      { key: 'proforma_invoice', label: 'Proforma Invoice', defaultPrefix: 'PI', defaultPadding: 5 },
    ],
  },
  {
    label: 'Purchase',
    entities: [
      { key: 'vendor', label: 'Vendor', defaultPrefix: 'VND', defaultPadding: 5 },
      { key: 'purchase_request', label: 'Purchase Request', defaultPrefix: 'PR', defaultPadding: 5 },
      { key: 'purchase_order', label: 'Purchase Order', defaultPrefix: 'PO', defaultPadding: 5 },
      { key: 'goods_receipt', label: 'Goods Receipt', defaultPrefix: 'GR', defaultPadding: 5 },
    ],
  },
  {
    label: 'Inventory',
    entities: [
      { key: 'product', label: 'Product / SKU', defaultPrefix: 'SKU', defaultPadding: 6 },
      { key: 'warehouse', label: 'Warehouse', defaultPrefix: 'WH', defaultPadding: 3 },
      { key: 'stock_adjustment', label: 'Stock Adjustment', defaultPrefix: 'ADJ', defaultPadding: 5 },
      { key: 'stock_transfer', label: 'Stock Transfer', defaultPrefix: 'TRF', defaultPadding: 5 },
    ],
  },
  {
    label: 'Projects',
    entities: [
      { key: 'project', label: 'Project', defaultPrefix: 'PRJ', defaultPadding: 4 },
      { key: 'project_risk', label: 'Risk', defaultPrefix: 'RSK', defaultPadding: 4 },
      { key: 'project_issue', label: 'Issue', defaultPrefix: 'ISS', defaultPadding: 4 },
      { key: 'change_request', label: 'Change Request', defaultPrefix: 'CR', defaultPadding: 4 },
      { key: 'status_report', label: 'Status Report', defaultPrefix: 'SR', defaultPadding: 4 },
    ],
  },
  {
    label: 'HR & Admin',
    entities: [
      { key: 'employee', label: 'Employee', defaultPrefix: 'EMP', defaultPadding: 5 },
      { key: 'department', label: 'Department', defaultPrefix: 'DEPT', defaultPadding: 4 },
      { key: 'leave_request', label: 'Leave Request', defaultPrefix: 'LR', defaultPadding: 5 },
      { key: 'payroll_run', label: 'Payroll Run', defaultPrefix: 'PAY', defaultPadding: 5 },
      { key: 'performance_review', label: 'Performance Review', defaultPrefix: 'REV', defaultPadding: 5 },
      { key: 'expense_claim', label: 'Expense Claim', defaultPrefix: 'EXP', defaultPadding: 5 },
    ],
  },
  {
    label: 'Support',
    entities: [
      { key: 'ticket', label: 'Ticket', defaultPrefix: 'TKT', defaultPadding: 5 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type Tab = 'company' | 'address' | 'contact' | 'tax' | 'defaults' | 'numbering';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'company', label: 'Company', icon: <Building2 className="size-4" /> },
  { key: 'address', label: 'Address', icon: <MapPin className="size-4" /> },
  { key: 'contact', label: 'Contact', icon: <Phone className="size-4" /> },
  { key: 'tax', label: 'Tax', icon: <Receipt className="size-4" /> },
  { key: 'defaults', label: 'Defaults', icon: <Settings2 className="size-4" /> },
  { key: 'numbering', label: 'Numbering', icon: <Hash className="size-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPreview(prefix: string, nextNumber: number, padding: number): string {
  return `${prefix}-${String(nextNumber).padStart(padding, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrganizationSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings>(INITIAL);
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  useEffect(() => {
    api.get('/settings/organization')
      .then(({ data }) => setSettings({ ...INITIAL, ...data }))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof OrgSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings((s) => ({ ...s, [key]: e.target.value }));

  const setSelect = (key: keyof OrgSettings) => (v: string) =>
    setSettings((s) => ({ ...s, [key]: v }));

  // Number series helpers
  const getSeries = useCallback((entityKey: string, defaultPrefix: string, defaultPadding: number): NumberSeries => {
    return settings.number_series?.[entityKey] ?? { prefix: defaultPrefix, padding: defaultPadding, next_number: 1 };
  }, [settings.number_series]);

  const updateSeries = (entityKey: string, field: keyof NumberSeries, value: string | number) => {
    setSettings((s) => {
      const series = { ...(s.number_series?.[entityKey] ?? { prefix: '', padding: 5, next_number: 1 }) };
      if (field === 'prefix') {
        series.prefix = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
      } else if (field === 'padding') {
        series.padding = Math.max(1, Math.min(10, Number(value) || 1));
      } else if (field === 'next_number') {
        series.next_number = Math.max(1, Number(value) || 1);
      }
      return { ...s, number_series: { ...s.number_series, [entityKey]: series } };
    });
  };

  const resetSeriesToDefaults = async () => {
    const defaults: Record<string, NumberSeries> = {};
    for (const group of SERIES_GROUPS) {
      for (const entity of group.entities) {
        defaults[entity.key] = { prefix: entity.defaultPrefix, padding: entity.defaultPadding, next_number: 1 };
      }
    }
    try {
      await api.put('/settings/organization/', { number_series: defaults });
      setSettings((s) => ({ ...s, number_series: defaults }));
      toast.success('Number series reset to defaults');
    } catch {
      toast.error('Failed to reset number series');
    }
    setResetDialogOpen(false);
    setResetConfirmText('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'numbering') {
        await api.put('/settings/organization/', { number_series: settings.number_series });
      } else {
        const { number_series, ...rest } = settings;
        await api.put('/settings/organization/', rest);
      }
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Organization Settings"
          breadcrumbs={[{ label: 'Settings' }, { label: 'Organization' }]}
        />
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Save className="mr-2 size-3.5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Company ────────────────────────────────────── */}
      {activeTab === 'company' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Information</CardTitle>
            <CardDescription>Basic details about your organization</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Company Name <span className="text-destructive">*</span></Label>
              <Input id="name" value={settings.name} onChange={set('name')} placeholder="Acme Inc." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="legal_name">Legal Name</Label>
              <Input id="legal_name" value={settings.legal_name} onChange={set('legal_name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registration_number">Registration Number</Label>
              <Input id="registration_number" value={settings.registration_number} onChange={set('registration_number')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Industry</Label>
              <Select value={settings.industry} onValueChange={setSelect('industry')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {['Technology', 'Manufacturing', 'Retail', 'Healthcare', 'Finance', 'Education', 'Other'].map((i) => (
                    <SelectItem key={i.toLowerCase()} value={i.toLowerCase()}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Company Size</Label>
              <Select value={settings.size} onValueChange={setSelect('size')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  {['1-10', '11-50', '51-200', '201-500', '500+'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={settings.website} onChange={set('website')} placeholder="https://acme.com" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Address ─────────────────────────────────────── */}
      {activeTab === 'address' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Address</CardTitle>
            <CardDescription>Primary business address for your organization</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input id="address_line1" value={settings.address_line1} onChange={set('address_line1')} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input id="address_line2" value={settings.address_line2} onChange={set('address_line2')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={settings.city} onChange={set('city')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State / Province</Label>
              <Input id="state" value={settings.state} onChange={set('state')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={settings.country} onChange={set('country')} placeholder="US" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input id="postal_code" value={settings.postal_code} onChange={set('postal_code')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Contact ─────────────────────────────────────── */}
      {activeTab === 'contact' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Details</CardTitle>
            <CardDescription>How customers and partners can reach you</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={settings.phone} onChange={set('phone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fax">Fax</Label>
              <Input id="fax" value={settings.fax} onChange={set('fax')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Company Email</Label>
              <Input id="email" type="email" value={settings.email} onChange={set('email')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="support_email">Support Email</Label>
              <Input id="support_email" type="email" value={settings.support_email} onChange={set('support_email')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Tax ─────────────────────────────────────────── */}
      {activeTab === 'tax' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax Configuration</CardTitle>
            <CardDescription>Tax identifiers and registration details</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input id="tax_id" value={settings.tax_id} onChange={set('tax_id')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vat_number">VAT Number</Label>
              <Input id="vat_number" value={settings.vat_number} onChange={set('vat_number')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax_country">Tax Country</Label>
              <Input id="tax_country" value={settings.tax_country} onChange={set('tax_country')} placeholder="US" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax_year_start">Tax Year Start</Label>
              <Input id="tax_year_start" type="date" value={settings.tax_year_start} onChange={set('tax_year_start')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Defaults ─────────────────────────────────────── */}
      {activeTab === 'defaults' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Preferences</CardTitle>
            <CardDescription>System-wide defaults for currency, timezone, and formatting</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Default Currency</Label>
              <Select value={settings.currency} onValueChange={setSelect('currency')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'], ['INR', 'Indian Rupee'], ['JPY', 'Japanese Yen']].map(([code, name]) => (
                    <SelectItem key={code} value={code}>{code} – {name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={setSelect('timezone')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Dubai'].map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date Format</Label>
              <Select value={settings.date_format} onValueChange={setSelect('date_format')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MMM D, YYYY">Jan 1, 2025</SelectItem>
                  <SelectItem value="MM/DD/YYYY">01/01/2025</SelectItem>
                  <SelectItem value="DD/MM/YYYY">01/01/2025 (EU)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">2025-01-01</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Language</Label>
              <Select value={settings.language} onValueChange={setSelect('language')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['ar', 'Arabic']].map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal_year_start">Fiscal Year Start</Label>
              <Input id="fiscal_year_start" value={settings.fiscal_year_start} onChange={set('fiscal_year_start')} placeholder="01-01" />
              <p className="text-xs text-muted-foreground">Format: MM-DD (e.g. 04-01 for April 1)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Numbering ────────────────────────────────────── */}
      {activeTab === 'numbering' && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">Document Numbering</CardTitle>
                <CardDescription className="mt-1">
                  Configure auto-generated prefixes and sequence numbers for each document type.
                  Numbers increment automatically when records are created.
                </CardDescription>
              </div>
              <AlertDialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirmText(''); }}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                    <RotateCcw className="mr-1.5 size-3.5" />
                    Reset Defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                      <TriangleAlert className="size-6 text-destructive" />
                    </div>
                    <AlertDialogTitle className="text-center">Reset all number series?</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                      This will reset <strong>all prefixes and sequence counters</strong> back to their
                      factory defaults. Any custom prefixes will be lost and all counters will restart at 1.
                      This action is immediate and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-2 py-2">
                    <Label htmlFor="reset-confirm" className="text-sm text-muted-foreground">
                      Type <span className="font-mono font-semibold text-foreground">RESET</span> to confirm
                    </Label>
                    <Input
                      id="reset-confirm"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="RESET"
                      className="font-mono"
                      autoComplete="off"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      disabled={resetConfirmText !== 'RESET'}
                      onClick={resetSeriesToDefaults}
                    >
                      Reset All Series
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
          </Card>

          {SERIES_GROUPS.map((group) => (
            <Card key={group.label}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{group.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Document Type</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Prefix</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-24">Digits</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-28">Next Number</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entities.map((entity, idx) => {
                        const series = getSeries(entity.key, entity.defaultPrefix, entity.defaultPadding);
                        const preview = formatPreview(
                          series.prefix || entity.defaultPrefix,
                          series.next_number || 1,
                          series.padding || entity.defaultPadding,
                        );
                        return (
                          <tr
                            key={entity.key}
                            className={idx < group.entities.length - 1 ? 'border-b' : ''}
                          >
                            <td className="px-4 py-2.5 font-medium">{entity.label}</td>
                            <td className="px-4 py-2">
                              <Input
                                value={series.prefix}
                                onChange={(e) => updateSeries(entity.key, 'prefix', e.target.value)}
                                className="h-8 w-24 font-mono text-xs uppercase"
                                maxLength={8}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                value={series.padding}
                                onChange={(e) => updateSeries(entity.key, 'padding', e.target.value)}
                                className="h-8 w-16 font-mono text-xs"
                                min={1}
                                max={10}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                value={series.next_number}
                                onChange={(e) => updateSeries(entity.key, 'next_number', e.target.value)}
                                className="h-8 w-24 font-mono text-xs"
                                min={1}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {preview}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
