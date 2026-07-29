import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, Input, Spinner } from '../../components/ui';

export default function ProductsList() {
  const { activeCompany } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', activeCompany?.id, debounced],
    queryFn: () =>
      api.get('/products', { params: { search: debounced, per_page: 25 } }).then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold">Products</h1>
        <p className="text-sm text-muted">Product master with live stock levels.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDebounced(search);
        }}
        className="relative max-w-md"
      >
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU or barcode…"
          className="pl-9"
        />
      </form>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Couldn't load products. Confirm the API is running.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">
            No products yet. The product master screen lands with the Milestone 1 masters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium">In stock</th>
                <th className="px-4 py-2.5 text-right font-medium">Reorder</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="tnum px-4 py-2.5 text-xs">{p.sku}</td>
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted">{p.unit || '—'}</td>
                  <td className="tnum px-4 py-2.5 text-right">
                    <span className={p.is_low_stock ? 'text-amber' : ''}>{p.current_stock}</span>
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-muted">{p.reorder_level}</td>
                  <td className="px-4 py-2.5">
                    {p.is_low_stock ? (
                      <Badge tone="warning">Low</Badge>
                    ) : (
                      <Badge tone="active">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
