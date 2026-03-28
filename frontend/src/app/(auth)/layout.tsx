import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cloudifyapps ERP',
  description: 'Sign in to your ERP account',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      {children}
    </div>
  );
}
