'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface OrgSettings {
  // Company
  name: string; legal_name: string; registration_number: string;
  industry: string; size: string; website: string; logo_url: string;
  // Address
  address_line1: string; address_line2: string; city: string;
  state: string; country: string; postal_code: string;
  // Contact
  phone: string; email: string; support_email: string; fax: string;
  // Tax
  tax_id: string; vat_number: string; tax_year_start: string; tax_country: string;
  // Defaults
  currency: string; timezone: string; date_format: string;
  fiscal_year_start: string; language: string;
}

const INITIAL: OrgSettings = {
  name: '', legal_name: '', registration_number: '', industry: '', size: '',
  website: '', logo_url: '', address_line1: '', address_line2: '', city: '',
  state: '', country: '', postal_code: '', phone: '', email: '', support_email: '',
  fax: '', tax_id: '', vat_number: '', tax_year_start: '', tax_country: '',
  currency: 'USD', timezone: 'UTC', date_format: 'MMM D, YYYY',
  fiscal_year_start: '01-01', language: 'en',
};

type Tab = 'company' | 'address' | 'contact' | 'tax' | 'defaults';

const TABS: { key: Tab; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'address', label: 'Address' },
  { key: 'contact', label: 'Contact' },
  { key: 'tax', label: 'Tax' },
  { key: 'defaults', label: 'Defaults' },
];

export default function OrganizationSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings>(INITIAL);
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/organization')
      .then(({ data }) => setSettings({ ...INITIAL, ...data }))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof OrgSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings((s) => ({ ...s, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/organization/', settings);
      toast.success('Organization settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="Organization Settings"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Organization' }]}
      />

      {/* Tab Nav */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {activeTab === 'company' && (
          <div className="grid grid-cols-2 gap-4">
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
              <Select value={settings.industry} onValueChange={(v) => setSettings((s) => ({ ...s, industry: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Company Size</Label>
              <Select value={settings.size} onValueChange={(v) => setSettings((s) => ({ ...s, size: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1–10</SelectItem>
                  <SelectItem value="11-50">11–50</SelectItem>
                  <SelectItem value="51-200">51–200</SelectItem>
                  <SelectItem value="201-500">201–500</SelectItem>
                  <SelectItem value="500+">500+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={settings.website} onChange={set('website')} placeholder="https://acme.com" />
            </div>
          </div>
        )}

        {activeTab === 'address' && (
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        )}

        {activeTab === 'defaults' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Default Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => setSettings((s) => ({ ...s, currency: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD – US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR – Euro</SelectItem>
                  <SelectItem value="GBP">GBP – British Pound</SelectItem>
                  <SelectItem value="INR">INR – Indian Rupee</SelectItem>
                  <SelectItem value="JPY">JPY – Japanese Yen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => setSettings((s) => ({ ...s, timezone: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date Format</Label>
              <Select value={settings.date_format} onValueChange={(v) => setSettings((s) => ({ ...s, date_format: v }))}>
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
              <Select value={settings.language} onValueChange={(v) => setSettings((s) => ({ ...s, language: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal_year_start">Fiscal Year Start</Label>
              <Input id="fiscal_year_start" value={settings.fiscal_year_start} onChange={set('fiscal_year_start')} placeholder="01-01" />
              <p className="text-xs text-muted-foreground">Format: MM-DD (e.g. 04-01 for April 1)</p>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
