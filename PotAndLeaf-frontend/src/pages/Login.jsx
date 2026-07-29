import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input, Spinner } from '../components/ui';

function PotLeafMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-9" aria-hidden>
      <path d="M16 4c5 2 8 6 8 10-4 1-7-1-8-4-1 3-4 5-8 4 0-4 3-8 8-10z" fill="var(--color-leaf)" />
      <path d="M9 19h14l-1.6 7.2a2 2 0 0 1-2 1.6h-6.8a2 2 0 0 1-2-1.6L9 19z" fill="var(--color-terracotta)" />
      <rect x="8" y="17.4" width="16" height="2.2" rx="1.1" fill="var(--color-terracotta)" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ??
          err.response?.data?.errors?.email?.[0] ??
          'Unable to sign in. Check your details and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-leaf p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
            <PotLeafMark />
          </span>
          <div className="leading-tight">
            <div className="font-semibold">Pot &amp; Leaf ERP</div>
            <div className="font-mono text-[11px] text-white/70">Cheerakuzhy Group of Nurseries</div>
          </div>
        </div>
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold leading-snug">
            One platform, from supplier to shelf.
          </h1>
          <p className="mt-3 text-sm text-white/80">
            Procurement, production, POS, rentals and reporting across every
            branch — with real-time visibility for the Head Office.
          </p>
        </div>
        <div className="font-mono text-[11px] text-white/60">Mannarkkad · Kerala</div>
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-terracotta/20" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <PotLeafMark />
            <span className="font-semibold">Pot &amp; Leaf ERP</span>
          </div>

          <h2 className="text-lg font-semibold">Sign in</h2>
          <p className="mb-6 text-sm text-muted">Welcome back. Enter your details to continue.</p>

          {error && (
            <div className="mb-4 rounded-[10px] border border-danger/30 bg-[#F7E9E6] px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email" required>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner className="border-white/40 border-t-white" /> : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
