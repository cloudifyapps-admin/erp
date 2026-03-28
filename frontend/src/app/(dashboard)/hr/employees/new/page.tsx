'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { normalizePaginated } from '@/lib/api-helpers';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface Department { id: string; name: string; }

interface EmployeeForm {
  // Personal
  first_name: string; last_name: string; email: string; phone: string;
  date_of_birth: string; gender: string; nationality: string; address: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  // Employment
  employee_id: string; department_id: string; designation: string;
  employment_type: string; date_of_joining: string; work_location: string;
  manager_id: string; salary: string; salary_currency: string; status: string;
  // Documents
  id_type: string; id_number: string; passport_number: string; passport_expiry: string;
}

const INITIAL: EmployeeForm = {
  first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
  gender: '', nationality: '', address: '', emergency_contact_name: '',
  emergency_contact_phone: '', employee_id: '', department_id: '', designation: '',
  employment_type: 'full_time', date_of_joining: new Date().toISOString().split('T')[0],
  work_location: '', manager_id: '', salary: '', salary_currency: 'USD',
  status: 'active', id_type: '', id_number: '', passport_number: '', passport_expiry: '',
};

type Tab = 'personal' | 'employment' | 'documents';

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState<EmployeeForm>(INITIAL);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hr/departments', { params: { page_size: 200 } })
      .then(({ data }) => setDepartments(normalizePaginated(data).items))
      .catch(() => {});
  }, []);

  const set = (key: keyof EmployeeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) { toast.error('First and last name are required'); return; }
    if (!form.email) { toast.error('Email is required'); return; }
    setSaving(true);
    try {
      await api.post('/hr/employees', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address || null,
        employee_id: form.employee_id || null,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        employment_type: form.employment_type,
        joining_date: form.date_of_joining || null,
        status: form.status,
      });
      toast.success('Employee created');
      router.push('/hr/employees');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create employee';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'personal', label: 'Personal' },
    { key: 'employment', label: 'Employment' },
    { key: 'documents', label: 'Documents' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <PageHeader
        title="New Employee"
        breadcrumbs={[{ label: 'HR' }, { label: 'Employees', href: '/hr/employees' }, { label: 'New' }]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Tab nav */}
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button
              type="button"
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

        {/* Personal Tab */}
        {activeTab === 'personal' && (
          <Card className="p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                <Input id="first_name" value={form.first_name} onChange={set('first_name')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="last_name">Last Name <span className="text-destructive">*</span></Label>
                <Input id="last_name" value={form.last_name} onChange={set('last_name')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input id="email" type="email" value={form.email} onChange={set('email')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={set('phone')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input id="date_of_birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" value={form.nationality} onChange={set('nationality')} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={form.address} onChange={set('address')} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emergency_contact_name">Emergency Contact</Label>
                <Input id="emergency_contact_name" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} placeholder="Full name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emergency_contact_phone">Emergency Phone</Label>
                <Input id="emergency_contact_phone" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
              </div>
            </div>
          </Card>
        )}

        {/* Employment Tab */}
        {activeTab === 'employment' && (
          <Card className="p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input id="employee_id" value={form.employee_id} onChange={set('employee_id')} placeholder="EMP-001" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" value={form.designation} onChange={set('designation')} placeholder="Software Engineer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Employment Type</Label>
                <Select value={form.employment_type} onValueChange={(v) => setForm((f) => ({ ...f, employment_type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date_of_joining">Date of Joining</Label>
                <Input id="date_of_joining" type="date" value={form.date_of_joining} onChange={set('date_of_joining')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="work_location">Work Location</Label>
                <Input id="work_location" value={form.work_location} onChange={set('work_location')} placeholder="HQ / Remote" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="salary">Salary</Label>
                <Input id="salary" type="number" min="0" step="0.01" value={form.salary} onChange={set('salary')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <Select value={form.salary_currency} onValueChange={(v) => setForm((f) => ({ ...f, salary_currency: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <Card className="p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>ID Type</Label>
                <Select value={form.id_type} onValueChange={(v) => setForm((f) => ({ ...f, id_type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select ID type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="tax_id">Tax ID</SelectItem>
                    <SelectItem value="social_security">Social Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="id_number">ID Number</Label>
                <Input id="id_number" value={form.id_number} onChange={set('id_number')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="passport_number">Passport Number</Label>
                <Input id="passport_number" value={form.passport_number} onChange={set('passport_number')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="passport_expiry">Passport Expiry</Label>
                <Input id="passport_expiry" type="date" value={form.passport_expiry} onChange={set('passport_expiry')} />
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-between">
          <div className="flex gap-2">
            {activeTab !== 'personal' && (
              <Button type="button" variant="outline" onClick={() => setActiveTab(activeTab === 'documents' ? 'employment' : 'personal')}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            {activeTab !== 'documents' ? (
              <Button type="button" onClick={() => setActiveTab(activeTab === 'personal' ? 'employment' : 'documents')}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Employee'}</Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
