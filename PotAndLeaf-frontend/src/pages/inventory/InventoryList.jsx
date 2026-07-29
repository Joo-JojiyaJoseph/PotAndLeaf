import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExclamationTriangleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Input, Modal, Spinner } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/format';

function LedgerModal({ product, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ledger', product?.id],
    queryFn: () => api.get('/inventory/ledger', { params: { product_id: product.id } }).then((r) => r.data),
    enabled: Boolean(product),
  });
  const rows = data?.data ?? [];

  return (
    <Modal open={Boolean(product)} onClose={onClose} title={product ? `Ledger — ${product.name}` : ''}>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-6" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No movements yet for this item.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-2 font-medium">Date</th>
              <th className="py-2 px-2 font-medium">Movement</th>
              <th className="py-2 px-2 text-right font-medium">Qty</th>
              <th className="py-2 pl-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-line/60 last:border-0">
                <td className="py-2 pr-2 font-mono text-xs text-muted">{formatDate(e.occurred_at)}</td>
                <td className="py-2 px-2">
                  <span className={e.direction === 'in' ? 'text-leaf' : 'text-danger'}>
                    {e.direction === 'in' ? 'In' : 'Out'}
                  </span>
                  <span className="ml-1 text-xs text-muted">{e.note}</span>
                </td>
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

export default function InventoryList() {
  const { activeCompany } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [ledgerProduct, setLedgerProduct] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inventory', 'stock', activeCompany?.id, debounced, lowOnly],
    queryFn: () =>
      api
        .get('/inventory/stock', { params: { search: debounced, low_only: lowOnly ? 1 : 0 } })
        .then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const { data: alerts } = useQuery({
    queryKey: ['inventory', 'alerts', activeCompany?.id],
    queryFn: () => api.get('/inventory/alerts').then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });

  const rows = data?.data ?? [];
  const alertCount = alerts?.length ?? 0;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">Live stock levels and the movement ledger behind them.</p>
      </div>

      {alertCount > 0 && (
        <div className="flex items-center gap-2 rounded-[10px] border border-amber/30 bg-[#F7EDD8] px-4 py-2.5 text-sm text-amber">
          <ExclamationTriangleIcon className="size-5 shrink-0" />
          <span>
            {alertCount} item{alertCount === 1 ? '' : 's'} at or below reorder level.
          </span>
          <button
            className="ml-auto font-medium underline"
            onClick={() => {
              setLowOnly(true);
            }}
          >
            Show
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(search);
          }}
          className="relative max-w-md flex-1"
        >
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
          />
        </form>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
            className="size-4 rounded border-line text-leaf focus:ring-leaf/40"
          />
          Low stock only
        </label>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-muted">Couldn't load inventory.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">No products match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 text-right font-medium">In stock</th>
                <th className="px-4 py-2.5 text-right font-medium">Reorder</th>
                <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="tnum px-4 py-2.5 text-xs">{p.sku}</td>
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="tnum px-4 py-2.5 text-right">
                    <span className={p.is_low_stock ? 'text-amber' : ''}>{p.current_stock}</span>
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-muted">{p.reorder_level}</td>
                  <td className="tnum px-4 py-2.5 text-right text-muted">
                    {p.cost_price != null ? formatCurrency(p.cost_price) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.is_low_stock ? <Badge tone="warning">Low</Badge> : <Badge tone="active">OK</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="outline" size="sm" onClick={() => setLedgerProduct(p)}>
                      Ledger
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <LedgerModal product={ledgerProduct} onClose={() => setLedgerProduct(null)} />
    </div>
  );
}
