import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';
import { formatCurrency } from '../../lib/format';

const STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
];

const EMPTY = {
  supplier_code: '',
  name: '',
  email: '',
  phone: '',
  gst_number: '',
  city: '',
  state: '',
  credit_days: '',
  credit_limit: '',
  opening_balance: '',
  notes: '',
  status: 'active',
};

const selectClass =
  'h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/30';

export default function SuppliersList() {
  const { activeCompany, can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['suppliers', activeCompany?.id, debounced, page],
    queryFn: () =>
      api
        .get('/suppliers', { params: { search: debounced, page, per_page: 15 } })
        .then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? null;

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api.put(`/suppliers/${editing.id}`, payload)
        : api.post('/suppliers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setModalOpen(false);
    },
    onError: (err) => {
      if (err.response?.status === 422) {
        const flat = {};
        Object.entries(err.response.data.errors ?? {}).forEach(
          ([k, v]) => (flat[k] = Array.isArray(v) ? v[0] : v),
        );
        setErrors(flat);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/suppliers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ ...EMPTY, ...row });
    setErrors({});
    setModalOpen(true);
  }

  function submitSearch(e) {
    e.preventDefault();
    setPage(1);
    setDebounced(search);
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrors({});
    saveMutation.mutate(form);
  }

  function confirmDelete(row) {
    if (window.confirm(`Delete ${row.name}? It can be restored later.`)) {
      deleteMutation.mutate(row.id);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Suppliers</h1>
          <p className="text-sm text-muted">Vendor master — GST, terms and outstanding balances.</p>
        </div>
        {can('suppliers.create') && (
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" /> New supplier
          </Button>
        )}
      </div>

      <form onSubmit={submitSearch} className="relative max-w-md">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code or GST…"
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
            Couldn't load suppliers. Confirm the API is running and a company is selected.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium">No suppliers yet</p>
            <p className="mt-1 text-sm text-muted">Add your first vendor to start recording purchases.</p>
            {can('suppliers.create') && (
              <Button size="sm" className="mt-4" onClick={openCreate}>
                <PlusIcon className="size-4" /> New supplier
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">GST</th>
                  <th className="px-4 py-2.5 font-medium">City</th>
                  <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                    <td className="tnum px-4 py-2.5 text-xs">{s.supplier_code}</td>
                    <td className="px-4 py-2.5"><button onClick={() => navigate(`/suppliers/${s.id}`)} className="font-medium text-ink hover:text-leaf">{s.name}</button></td>
                    <td className="tnum px-4 py-2.5 text-xs text-muted">{s.gst_number || '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{s.city || '—'}</td>
                    <td className="tnum px-4 py-2.5 text-right">
                      {formatCurrency(s.outstanding ?? s.opening_balance ?? 0)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={s.status}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {(s.can?.update ?? can('suppliers.update')) && (
                          <button
                            onClick={() => openEdit(s)}
                            className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink"
                            aria-label="Edit"
                          >
                            <PencilSquareIcon className="size-4" />
                          </button>
                        )}
                        {(s.can?.delete ?? can('suppliers.delete')) && (
                          <button
                            onClick={() => confirmDelete(s)}
                            className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-danger"
                            aria-label="Delete"
                          >
                            <TrashIcon className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="divide-y divide-line sm:hidden">
              {rows.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="tnum text-xs text-muted">{s.supplier_code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={s.status}>{s.status}</Badge>
                    {(s.can?.update ?? can('suppliers.update')) && (
                      <button onClick={() => openEdit(s)} className="p-1.5 text-muted" aria-label="Edit">
                        <PencilSquareIcon className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {meta.from}–{meta.to} of {meta.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit supplier' : 'New supplier'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save supplier'}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier code" required error={errors.supplier_code}>
            <Input value={form.supplier_code} onChange={set('supplier_code')} placeholder="SUP-001" />
          </Field>
          <Field label="Name" required error={errors.name}>
            <Input value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="GST number" error={errors.gst_number}>
            <Input value={form.gst_number} onChange={set('gst_number')} />
          </Field>
          <Field label="City" error={errors.city}>
            <Input value={form.city} onChange={set('city')} />
          </Field>
          <Field label="Credit days" error={errors.credit_days}>
            <Input type="number" value={form.credit_days} onChange={set('credit_days')} />
          </Field>
          <Field label="Credit limit" error={errors.credit_limit}>
            <Input type="number" step="0.01" value={form.credit_limit} onChange={set('credit_limit')} />
          </Field>
          <Field label="Opening balance" error={errors.opening_balance}>
            <Input type="number" step="0.01" value={form.opening_balance} onChange={set('opening_balance')} />
          </Field>
          <Field label="Status" required error={errors.status}>
            <select value={form.status} onChange={set('status')} className={selectClass}>
              {STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" error={errors.notes}>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                rows={2}
                className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/30"
              />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
