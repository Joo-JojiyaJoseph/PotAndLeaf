import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExclamationTriangleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Input, Modal, Spinner, StatCard } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/format';

const TABS = [
  { value: 'levels', label: 'Stock levels' },
  { value: 'valuation', label: 'Valuation' },
  { value: 'movement', label: 'Fast / slow / dead' },
  { value: 'locations', label: 'By location' },
];
const classTone = { fast: 'active', slow: 'warning', dead: 'blocked' };

function LedgerModal({ product, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ledger', product?.id],
    queryFn: () => api.get('/inventory/ledger', { params: { product_id: product.id } }).then((r) => r.data),
    enabled: Boolean(product),
  });
  const rows = data?.data ?? [];
  return (
    <Modal open={Boolean(product)} onClose={onClose} title={product ? `Ledger — ${product.name}` : ''}>
      {isLoading ? <div className="flex justify-center py-10"><Spinner className="size-6" /></div>
        : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted">No movements yet.</p>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-faint">
              <th className="microlabel py-2 pr-2 font-semibold">Date</th>
              <th className="microlabel py-2 px-2 font-semibold">Movement</th>
              <th className="microlabel py-2 px-2 text-right font-semibold">Qty</th>
              <th className="microlabel py-2 pl-2 text-right font-semibold">Balance</th>
            </tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-2 font-mono text-xs text-muted">{formatDate(e.occurred_at)}</td>
                  <td className="py-2 px-2"><span className={e.direction === 'in' ? 'text-leaf' : 'text-danger'}>{e.direction === 'in' ? 'In' : 'Out'}</span><span className="ml-1 text-xs text-muted">{e.note}</span></td>
                  <td className="tnum py-2 px-2 text-right">{e.qty}</td>
                  <td className="tnum py-2 pl-2 text-right font-medium">{e.balance_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </Modal>
  );
}

function LevelsTab({ onLedger }) {
  const { activeCompany } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'stock', activeCompany?.id, debounced, lowOnly],
    queryFn: () => api.get('/inventory/stock', { params: { search: debounced, low_only: lowOnly ? 1 : 0 } }).then((r) => r.data),
    keepPreviousData: true,
  });
  const { data: alerts } = useQuery({ queryKey: ['inventory', 'alerts', activeCompany?.id], queryFn: () => api.get('/inventory/alerts').then((r) => r.data.data) });
  const rows = data?.data ?? [];
  const alertCount = alerts?.length ?? 0;

  return (
    <div className="space-y-4">
      {alertCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-soft px-4 py-2.5 text-sm text-amber">
          <ExclamationTriangleIcon className="size-5 shrink-0" />
          <span>{alertCount} item{alertCount === 1 ? '' : 's'} at or below reorder level.</span>
          <button className="ml-auto font-medium underline" onClick={() => setLowOnly(true)}>Show</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setDebounced(search); }} className="relative max-w-md flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-9" />
        </form>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="size-4 rounded border-line text-leaf focus:ring-leaf/40" />
          Low stock only
        </label>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
          : rows.length === 0 ? <div className="px-4 py-16 text-center text-sm text-muted">No products match.</div>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">SKU</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Product</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">In stock</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Reorder</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Unit cost</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Status</th>
                <th className="microlabel px-4 py-2.5" />
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                    <td className="tnum px-4 py-2.5 text-xs">{p.sku}</td>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="tnum px-4 py-2.5 text-right"><span className={p.is_low_stock ? 'text-amber' : ''}>{p.current_stock}</span></td>
                    <td className="tnum px-4 py-2.5 text-right text-muted">{p.reorder_level}</td>
                    <td className="tnum px-4 py-2.5 text-right text-muted">{p.cost_price != null ? formatCurrency(p.cost_price) : '—'}</td>
                    <td className="px-4 py-2.5">{p.is_low_stock ? <Badge tone="warning">Low</Badge> : <Badge tone="active">OK</Badge>}</td>
                    <td className="px-4 py-2.5 text-right"><Button variant="outline" size="sm" onClick={() => onLedger(p)}>Ledger</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </div>
  );
}

function ValuationTab() {
  const { activeCompany } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['inventory', 'valuation', activeCompany?.id], queryFn: () => api.get('/inventory/valuation').then((r) => r.data.data) });
  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="size-6" /></div>;
  const rows = data?.items ?? [];
  const t = data?.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={t.products ?? 0} tone="info" />
        <StatCard label="Total units" value={t.total_units ?? 0} tone="default" />
        <StatCard label="Stock value" value={formatCurrency(t.total_value ?? 0)} tone="good" />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-faint">
            <th className="microlabel px-4 py-2.5 font-semibold">SKU</th>
            <th className="microlabel px-4 py-2.5 font-semibold">Product</th>
            <th className="microlabel px-4 py-2.5 text-right font-semibold">Stock</th>
            <th className="microlabel px-4 py-2.5 text-right font-semibold">Unit cost</th>
            <th className="microlabel px-4 py-2.5 text-right font-semibold">Value</th>
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                <td className="tnum px-4 py-2.5 text-xs">{p.sku}</td>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="tnum px-4 py-2.5 text-right text-muted">{p.stock}</td>
                <td className="tnum px-4 py-2.5 text-right text-muted">{formatCurrency(p.cost)}</td>
                <td className="tnum px-4 py-2.5 text-right font-medium">{formatCurrency(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function MovementTab() {
  const { activeCompany } = useAuth();
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({ queryKey: ['inventory', 'movement', activeCompany?.id, days], queryFn: () => api.get('/inventory/movement', { params: { days } }).then((r) => r.data.data) });
  const rows = data?.items ?? [];
  const s = data?.summary ?? {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[30, 60, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={'rounded-lg px-3 py-1.5 text-sm ' + (days === d ? 'bg-leaf text-white' : 'bg-surface text-muted shadow-soft')}>{d}d</button>
          ))}
        </div>
        <div className="flex gap-4 text-sm">
          <span><Badge tone="active">Fast</Badge> <span className="tnum ml-1">{s.fast ?? 0}</span></span>
          <span><Badge tone="warning">Slow</Badge> <span className="tnum ml-1">{s.slow ?? 0}</span></span>
          <span><Badge tone="blocked">Dead</Badge> <span className="tnum ml-1">{s.dead ?? 0}</span></span>
        </div>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">SKU</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Product</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">In stock</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Out ({days}d)</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Last out</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Class</th>
              </tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                    <td className="tnum px-4 py-2.5 text-xs">{p.sku}</td>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="tnum px-4 py-2.5 text-right text-muted">{p.stock}</td>
                    <td className="tnum px-4 py-2.5 text-right text-muted">{p.out_qty}</td>
                    <td className="px-4 py-2.5 text-muted">{p.last_out ? formatDate(p.last_out) : '—'}</td>
                    <td className="px-4 py-2.5"><Badge tone={classTone[p.class]}>{p.class}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </div>
  );
}

function ByLocationTab() {
  const { activeCompany } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['inventory', 'by-location', activeCompany?.id], queryFn: () => api.get('/inventory/by-location').then((r) => r.data.data.balances) });
  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="size-6" /></div>;
  const rows = data ?? [];
  const groups = rows.reduce((acc, r) => { (acc[r.location_name] ||= []).push(r); return acc; }, {});
  if (rows.length === 0) return <Card className="px-4 py-16 text-center text-sm text-muted">No per-location stock yet. Confirm a purchase or a transfer to populate locations.</Card>;
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([loc, items]) => (
        <Card key={loc} className="overflow-hidden">
          <div className="border-b border-line bg-[#FAFBFA] px-4 py-2.5 microlabel font-semibold text-ink">{loc}</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-faint">
              <th className="microlabel px-4 py-2 font-semibold">SKU</th>
              <th className="microlabel px-4 py-2 font-semibold">Product</th>
              <th className="microlabel px-4 py-2 text-right font-semibold">Qty here</th>
            </tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.location_id + r.product_id} className="border-b border-line/60 last:border-0">
                  <td className="tnum px-4 py-2 text-xs">{r.sku}</td>
                  <td className="px-4 py-2 font-medium">{r.product_name}</td>
                  <td className="tnum px-4 py-2 text-right">{r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

export default function InventoryList() {
  const [tab, setTab] = useState('levels');
  const [ledgerProduct, setLedgerProduct] = useState(null);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">Live stock, valuation, and movement analysis.</p>
      </div>
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={'border-b-2 px-3 py-2 text-sm transition-colors ' + (tab === t.value ? 'border-leaf font-medium text-leaf' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'levels' && <LevelsTab onLedger={setLedgerProduct} />}
      {tab === 'valuation' && <ValuationTab />}
      {tab === 'movement' && <MovementTab />}
      {tab === 'locations' && <ByLocationTab />}
      <LedgerModal product={ledgerProduct} onClose={() => setLedgerProduct(null)} />
    </div>
  );
}
