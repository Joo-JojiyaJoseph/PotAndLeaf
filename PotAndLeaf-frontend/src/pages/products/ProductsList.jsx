import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, TrashIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../lib/confirm';
import { Badge, Button, Card, Input, Spinner } from '../../components/ui';
import Pagination from '../../components/Pagination';
import StatusToggle from '../../components/StatusToggle';

export default function ProductsList() {
  const { activeCompany, can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', activeCompany?.id, debounced, page],
    queryFn: () => api.get('/products', { params: { search: debounced, per_page: 25, page } }).then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  async function onToggle(p, next) {
    await api.patch(`/products/${p.id}/status`, { status: next ? 'active' : 'inactive' });
    toast.success(`${p.name} ${next ? 'activated' : 'deactivated'}`);
    invalidate();
  }

  async function onDelete(p) {
    const ok = await confirm({
      title: 'Delete product',
      message: `Delete ${p.name}? This is a soft delete — stock history is preserved.`,
      confirmLabel: 'Delete', tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success(`${p.name} deleted`);
      invalidate();
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'Could not delete product.');
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Products</h1>
          <p className="text-sm text-muted">Product master with live stock levels and barcodes.</p>
        </div>
        {can('products.create') && (
          <div className="flex items-center gap-2">
            <Link to="/products/labels"><Button variant="outline" size="sm"><QrCodeIcon className="size-4" /> Labels</Button></Link>
            <Link to="/products/new"><Button size="sm"><PlusIcon className="size-4" /> New product</Button></Link>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setDebounced(search); }} className="relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU or barcode…" className="pl-9" />
      </form>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-muted">Couldn't load products.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium">No products yet</p>
            <p className="mt-1 text-sm text-muted">Add your first product to start purchasing and selling.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">SKU</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Name</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Barcode</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">In stock</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Status</th>
                <th className="microlabel px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                  <td className="tnum px-4 py-2.5 text-xs">{p.sku}</td>
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="tnum px-4 py-2.5 text-xs text-muted">{p.barcode || '—'}</td>
                  <td className="tnum px-4 py-2.5 text-right"><span className={p.is_low_stock ? 'text-amber' : ''}>{p.current_stock}</span></td>
                  <td className="px-4 py-2.5">
                    {can('products.update')
                      ? <StatusToggle active={p.status === 'active'} onToggle={(next) => onToggle(p, next)} />
                      : <Badge tone={p.status === 'active' ? 'active' : 'inactive'}>{p.status}</Badge>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {can('products.update') && (
                        <button onClick={() => navigate(`/products/${p.id}/edit`)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Edit"><PencilSquareIcon className="size-4" /></button>
                      )}
                      {can('products.delete') && (
                        <button onClick={() => onDelete(p)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Delete"><TrashIcon className="size-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && rows.length > 0 && (
          <div className="border-t border-line px-3"><Pagination meta={data?.meta} onPage={setPage} /></div>
        )}
      </Card>
    </div>
  );
}
