import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard, Spinner, Badge } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/format';

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const PRESETS = [{ label: '7d', days: 6 }, { label: '30d', days: 29 }, { label: '90d', days: 89 }];

function TrendChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const W = 720, H = 200, pad = 28;
  const n = data.length;
  const bw = n > 0 ? (W - pad * 2) / n : 0;
  if (n === 0) return <div className="py-12 text-center text-sm text-muted">No sales in this range.</div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-line, #e5e7eb)" />
      {data.map((d, i) => {
        const h = ((d.total / max) * (H - pad * 2));
        const x = pad + i * bw + bw * 0.15;
        const y = H - pad - h;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={bw * 0.7} height={Math.max(0, h)} rx="2" fill="var(--color-leaf, #4a7c59)" opacity="0.85">
              <title>{`${d.date}: ${formatCurrency(d.total)}`}</title>
            </rect>
          </g>
        );
      })}
      <text x={pad} y={H - 6} fontSize="10" fill="var(--color-muted, #9ca3af)">{data[0]?.date}</text>
      <text x={W - pad} y={H - 6} fontSize="10" textAnchor="end" fill="var(--color-muted, #9ca3af)">{data[n - 1]?.date}</text>
    </svg>
  );
}

export default function ReportsPage() {
  const { activeCompany } = useAuth();
  const [range, setRange] = useState({ from: daysAgo(29), to: iso(new Date()) });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-dashboard', activeCompany?.id, range.from, range.to],
    queryFn: () => api.get('/reports/dashboard', { params: range }).then((r) => r.data.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const modeRows = useMemo(() => Object.entries(data?.sales?.by_mode ?? {}), [data]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-sm text-muted">Business summary for {activeCompany?.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-line">
            {PRESETS.map((p) => {
              const on = range.from === daysAgo(p.days) && range.to === iso(new Date());
              return <button key={p.label} onClick={() => setRange({ from: daysAgo(p.days), to: iso(new Date()) })}
                className={'px-3 py-1.5 text-sm ' + (on ? 'bg-leaf text-white' : 'bg-surface text-muted hover:text-ink')}>{p.label}</button>;
            })}
          </div>
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
          <span className="text-muted">–</span>
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="size-6" /></div>
        : isError || !data ? <Card className="px-4 py-16 text-center text-sm text-muted">Couldn't load reports.</Card>
        : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard label="Sales" value={formatCurrency(data.sales.total)} sub={`${data.sales.count} invoices`} />
              <StatCard label="Purchases" value={formatCurrency(data.purchases.total)} sub={`${data.purchases.count} GRNs`} />
              <StatCard label="Receivables" value={formatCurrency(data.receivables)} sub="owed by customers" />
              <StatCard label="Payables" value={formatCurrency(data.payables)} sub="owed to suppliers" />
              <StatCard label="Stock value" value={formatCurrency(data.inventory.stock_value)} sub={`${data.inventory.skus} SKUs`} />
            </div>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Sales trend</h2>
                <span className="text-xs text-muted">{formatDate(range.from)} – {formatDate(range.to)}</span>
              </div>
              <TrendChart data={data.sales.trend} />
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="overflow-hidden">
                <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">Top products</div>
                {data.top_products.length === 0 ? <div className="px-4 py-10 text-center text-sm text-muted">No sales yet.</div>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-line text-left text-faint"><th className="microlabel px-4 py-2 font-semibold">Product</th><th className="microlabel px-4 py-2 text-right font-semibold">Qty</th><th className="microlabel px-4 py-2 text-right font-semibold">Revenue</th></tr></thead>
                    <tbody>{data.top_products.map((p) => (
                      <tr key={p.name} className="border-b border-line/60 last:border-0"><td className="px-4 py-2 font-medium">{p.name}</td><td className="tnum px-4 py-2 text-right text-muted">{p.qty}</td><td className="tnum px-4 py-2 text-right font-medium">{formatCurrency(p.revenue)}</td></tr>
                    ))}</tbody>
                  </table>}
              </Card>
              <Card className="overflow-hidden">
                <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">Top customers</div>
                {data.top_customers.length === 0 ? <div className="px-4 py-10 text-center text-sm text-muted">No sales yet.</div>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-line text-left text-faint"><th className="microlabel px-4 py-2 font-semibold">Customer</th><th className="microlabel px-4 py-2 text-right font-semibold">Revenue</th></tr></thead>
                    <tbody>{data.top_customers.map((c) => (
                      <tr key={c.name} className="border-b border-line/60 last:border-0"><td className="px-4 py-2 font-medium">{c.name}</td><td className="tnum px-4 py-2 text-right font-medium">{formatCurrency(c.revenue)}</td></tr>
                    ))}</tbody>
                  </table>}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Sales by payment mode</h2>
                {modeRows.length === 0 ? <p className="text-sm text-muted">No sales.</p>
                  : <div className="space-y-1.5">{modeRows.map(([mode, total]) => (
                    <div key={mode} className="flex items-center justify-between text-sm"><Badge tone="info">{mode}</Badge><span className="tnum font-medium">{formatCurrency(total)}</span></div>
                  ))}</div>}
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Production</h2>
                <div className="flex items-baseline justify-between text-sm"><span className="text-muted">Completed runs</span><span className="tnum font-medium">{data.production.completed}</span></div>
                <div className="mt-1 flex items-baseline justify-between text-sm"><span className="text-muted">Input value</span><span className="tnum font-medium">{formatCurrency(data.production.output_value)}</span></div>
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Rentals</h2>
                <div className="flex items-baseline justify-between text-sm"><span className="text-muted">Active rentals</span><span className="tnum font-medium">{data.rentals.active}</span></div>
                <div className="mt-1 flex items-baseline justify-between text-sm"><span className="text-muted">Invoiced in range</span><span className="tnum font-medium">{formatCurrency(data.rentals.invoiced)}</span></div>
                {data.inventory.low_stock > 0 && <div className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">{data.inventory.low_stock} product(s) at or below reorder level.</div>}
              </Card>
            </div>
          </>
        )}
    </div>
  );
}
