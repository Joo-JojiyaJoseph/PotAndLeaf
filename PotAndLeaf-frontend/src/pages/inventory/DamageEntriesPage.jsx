import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../lib/toast';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';
import { ImageUpload } from '../../components/media';
import { formatDate } from '../../lib/format';
import Pagination from '../../components/Pagination';

const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';
const today = () => new Date().toISOString().slice(0, 10);

function DamageFormModal({ open, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    product_id: '', location_id: '', qty: '', reason: '', notes: '', photo: null, entry_date: today(),
  });
  const [errors, setErrors] = useState({});

  const { data: formData } = useQuery({
    queryKey: ['damage-form-data'],
    queryFn: () => api.get('/damage-entries/form-data').then((r) => r.data.data),
    enabled: open,
  });

  const saveM = useMutation({
    mutationFn: () => api.post('/damage-entries', {
      product_id: form.product_id || null,
      location_id: form.location_id || null,
      qty: Number(form.qty) || 0,
      reason: form.reason === 'Other' ? (form.notes || 'Other') : form.reason,
      notes: form.notes || null,
      photo: form.photo || null,
      entry_date: form.entry_date,
    }),
    onSuccess: () => {
      toast.success('Damage entry recorded — stock deducted.');
      queryClient.invalidateQueries({ queryKey: ['damage-entries'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      handleClose();
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? 'Could not save damage entry.');
    },
  });

  function handleClose() {
    setForm({ product_id: '', location_id: '', qty: '', reason: '', notes: '', photo: null, entry_date: today() });
    setErrors({});
    onClose();
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];
  const product = (formData?.products ?? []).find((p) => String(p.id) === String(form.product_id));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record damage"
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" disabled={saveM.isPending} onClick={() => saveM.mutate()}>
            {saveM.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save & deduct stock'}
          </Button>
        </>
      )}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Product" required error={err('product_id')}>
            <select value={form.product_id} onChange={set('product_id')} className={selectCls}>
              <option value="">Select product…</option>
              {(formData?.products ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name} (stock {p.current_stock})</option>
              ))}
            </select>
            {product && <span className="mt-1 block text-xs text-muted">Available: {product.current_stock}</span>}
          </Field>
        </div>
        <Field label="Location" error={err('location_id')}>
          <select value={form.location_id} onChange={set('location_id')} className={selectCls}>
            <option value="">Company stock (no location)</option>
            {(formData?.locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}{l.is_default ? ' (default)' : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Quantity" required error={err('qty')}>
          <Input type="number" step="0.001" min="0" value={form.qty} onChange={set('qty')} />
        </Field>
        <Field label="Reason" required error={err('reason')}>
          <select value={form.reason} onChange={set('reason')} className={selectCls}>
            <option value="">Select reason…</option>
            {(formData?.reasons ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Date" required error={err('entry_date')}>
          <Input type="date" value={form.entry_date} onChange={set('entry_date')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" error={err('notes')}>
            <Input value={form.notes} onChange={set('notes')} placeholder="Optional details…" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Photo (optional)" error={err('photo')}>
            <ImageUpload value={form.photo} onChange={(url) => setForm((f) => ({ ...f, photo: url }))} shape="square" hint="Optional evidence photo" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function DamageEntriesPage() {
  const { activeCompany, can } = useAuth();
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(1);
  const [movementFilter, setMovementFilter] = useState('');

  const listQ = useQuery({
    queryKey: ['damage-entries', activeCompany?.id, page],
    queryFn: () => api.get('/damage-entries', { params: { per_page: 25, page } }).then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const ledgerQ = useQuery({
    queryKey: ['inventory', 'ledger', 'damage', activeCompany?.id, movementFilter],
    queryFn: () => api.get('/inventory/ledger', {
      params: { reference_type: movementFilter || 'damage', per_page: 25 },
    }).then((r) => r.data),
    enabled: Boolean(activeCompany) && movementFilter === 'damage',
  });

  const rows = listQ.data?.data ?? [];
  const ledgerRows = ledgerQ.data?.data ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Damage Entry</h1>
          <p className="text-sm text-muted">Write off damaged stock — posts a Damage movement to the ledger.</p>
        </div>
        {can('damage.create') && (
          <Button size="sm" onClick={() => setModal(true)}>
            <PlusIcon className="size-4" /> Record damage
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={movementFilter === '' ? 'primary' : 'outline'}
          onClick={() => setMovementFilter('')}
        >
          Entries
        </Button>
        <Button
          size="sm"
          variant={movementFilter === 'damage' ? 'primary' : 'outline'}
          onClick={() => setMovementFilter('damage')}
        >
          Ledger (Damage)
        </Button>
      </div>

      {movementFilter === 'damage' ? (
        <Card className="overflow-hidden">
          {ledgerQ.isLoading ? (
            <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
          ) : ledgerRows.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted">No damage ledger movements yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-faint">
                  <th className="microlabel px-4 py-2.5 font-semibold">Date</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Product</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Type</th>
                  <th className="microlabel px-4 py-2.5 text-right font-semibold">Qty out</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((e) => (
                  <tr key={e.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{formatDate(e.occurred_at)}</td>
                    <td className="px-4 py-2.5">{e.product?.name ?? '—'}</td>
                    <td className="px-4 py-2.5"><Badge tone="blocked">{e.reference_type}</Badge></td>
                    <td className="tnum px-4 py-2.5 text-right text-danger">{e.qty}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {listQ.isLoading ? (
            <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted">No damage entries yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-faint">
                  <th className="microlabel px-4 py-2.5 font-semibold">Entry</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Date</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Product</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Location</th>
                  <th className="microlabel px-4 py-2.5 text-right font-semibold">Qty</th>
                  <th className="microlabel px-4 py-2.5 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-line/60 last:border-0">
                    <td className="tnum px-4 py-2.5 text-xs">{e.entry_no}</td>
                    <td className="px-4 py-2.5">{formatDate(e.entry_date)}</td>
                    <td className="px-4 py-2.5 font-medium">{e.product?.name}</td>
                    <td className="px-4 py-2.5 text-muted">{e.location?.name ?? '—'}</td>
                    <td className="tnum px-4 py-2.5 text-right text-danger">{e.qty}</td>
                    <td className="px-4 py-2.5 text-sm">{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!listQ.isLoading && rows.length > 0 && (
            <div className="border-t border-line px-3">
              <Pagination meta={listQ.data?.meta} onPage={setPage} />
            </div>
          )}
        </Card>
      )}

      <DamageFormModal open={modal} onClose={() => setModal(false)} />
    </div>
  );
}
