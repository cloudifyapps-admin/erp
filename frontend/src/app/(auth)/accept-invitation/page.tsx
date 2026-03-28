'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface InvitationInfo {
  email: string;
  tenant_name: string;
  inviter_name: string;
  role_name: string | null;
  has_account: boolean;
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields (for new users)
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setLoading(false);
      return;
    }
    api.get('/auth/invitation-info', { params: { token } })
      .then((res) => setInfo(res.data))
      .catch((err) => {
        const detail = err?.response?.data?.detail;
        setError(detail || 'This invitation link is invalid or has expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { token };
      if (!info?.has_account) {
        payload.name = name;
        payload.password = password;
      }
      const res = await api.post('/auth/accept-invitation', payload);
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      setSuccess(true);
      setTimeout(() => router.replace('/'), 1500);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSubmitError(detail || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <XCircle className="size-5" />
          </div>
          <CardTitle className="text-xl">Invitation Invalid</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login">
            <Button variant="outline" className="mt-2">Go to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="size-5" />
          </div>
          <CardTitle className="text-xl">Welcome!</CardTitle>
          <CardDescription>
            You&apos;ve joined <strong>{info?.tenant_name}</strong>. Redirecting to dashboard...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="items-center text-center pb-2">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <LayoutDashboard className="size-5" />
        </div>
        <CardTitle className="text-xl">Join {info?.tenant_name}</CardTitle>
        <CardDescription>
          <strong>{info?.inviter_name}</strong> invited you
          {info?.role_name ? ` as ${info.role_name}` : ''}.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleAccept} className="flex flex-col gap-4">
          {submitError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input value={info?.email ?? ''} disabled className="bg-muted" />
          </div>

          {!info?.has_account && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Create a password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {info?.has_account && (
            <p className="text-sm text-muted-foreground">
              You already have an account with this email. Click below to join the organization.
            </p>
          )}

          <Button type="submit" className="mt-1 w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {info?.has_account ? 'Join Organization' : 'Create Account & Join'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already a member?{' '}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in instead
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    }>
      <AcceptInvitationContent />
    </Suspense>
  );
}
