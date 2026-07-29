import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Input, Modal, Spinner } from '../../components/ui';

export default function ProductsList() {
  const { activeCompany, can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', activeCompany?.id, debounced],
    queryFn: () => api.get('/products', { params: { search: debounced, per_page: 25 } }).then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const deleteM = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleting(null);
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Products</h1>
          <p className="text-sm text-muted">Product master with live stock levels and barcodes.</p>
        </div>
        {can('products.create') && (
          <Link to="/products/new">
            <Button size="sm"><PlusIcon className="size-4" /> New product</Button>
          </Link>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setDebounced(search); }} className="relative max-w-md">
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
                  <td className="tnum px-4 py-2.5 text-right">
                    <span className={p.is_low_stock ? 'text-amber' : ''}>{p.current_stock}</span>
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={p.status === 'active' ? 'active' : 'inactive'}>{p.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {can('products.update') && (
                        <button onClick={() => navigate(`/products/${p.id}/edit`)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Edit">
                          <PencilSquareIcon className="size-4" />
                        </button>
                      )}
                      {can('products.delete') && (
                        <button onClick={() => setDeleting(p)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Delete">
                          <TrashIcon className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete product"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={deleteM.isPending} onClick={() => deleteM.mutate(deleting.id)}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Delete <span className="font-medium text-ink">{deleting?.name}</span>? This is a soft delete — stock history is preserved.
        </p>
      </Modal>
    </div>
  );
}
