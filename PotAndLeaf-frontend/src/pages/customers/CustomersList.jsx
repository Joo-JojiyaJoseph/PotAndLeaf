import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../lib/confirm';
import Pagination from '../../components/Pagination';
import StatusToggle from '../../components/StatusToggle';

const empty = { customer_code: '', name: '', type: 'retail', phone: '', whatsapp: '', email: '', gst_number: '', city: '', state: '', credit_days: '', credit_limit: '', opening_balance: '', address_line1: '', notes: '', status: 'active' };
const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';
const typeTone = { retail: 'info', wholesale: 'active', dealer: 'pending' };
const TYPES = [{ v: '', l: 'All types' }, { v: 'retail', l: 'Retail' }, { v: 'wholesale', l: 'Wholesale' }, { v: 'dealer', l: 'Dealer' }];

export default function CustomersList() {
  const { activeCompany, can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', activeCompany?.id, debounced, type, page],
    queryFn: () => api.get('/customers', { params: { search: debounced, type, page, per_page: 25 } }).then((r) => r.data),
    enabled: Boolean(activeCompany),
    keepPreviousData: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customers'] });
  const saveM = useMutation({
    mutationFn: (payload) => (payload.id ? api.put(`/customers/${payload.id}`, payload) : api.post('/customers', payload)),
    onSuccess: (_r, payload) => { invalidate(); setEditing(null); toast.success(payload.id ? 'Customer updated.' : 'Customer created.'); },
    onError: (err) => { setErrors(err.response?.data?.errors ?? {}); toast.error(err.response?.data?.message ?? 'Could not save customer.'); },
  });

  async function onToggle(c, next) {
    await api.patch(`/customers/${c.id}/status`, { status: next ? 'active' : 'inactive' });
    toast.success(`${c.name} ${next ? 'activated' : 'deactivated'}`);
    invalidate();
  }
  async function onDelete(c) {
    const ok = await confirm({ title: 'Delete customer', message: `Delete ${c.name}? This is a soft delete.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try { await api.delete(`/customers/${c.id}`); toast.success(`${c.name} deleted`); invalidate(); }
    catch (e) { toast.error(e.response?.data?.message ?? 'Could not delete customer.'); }
  }

  const openNew = () => { setForm(empty); setErrors({}); setEditing({}); };
  const openEdit = (c) => { setForm({ ...empty, ...c }); setErrors({}); setEditing(c); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];
  const rows = data?.data ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Customers</h1>
          <p className="text-sm text-muted">Customer master — types, GST, credit terms and balances.</p>
        </div>
        {can('customers.create') && <Button size="sm" onClick={openNew}><PlusIcon className="size-4" /> New customer</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setDebounced(search); }} className="relative max-w-md flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, phone or GST…" className="pl-9" />
        </form>
        <select value={type} onChange={(e) => { setPage(1); setType(e.target.value); }} className={selectCls + ' max-w-[160px]'}>
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
          : isError ? <div className="px-4 py-12 text-center text-sm text-muted">Couldn't load customers.</div>
          : rows.length === 0 ? (
            <div className="px-4 py-16 text-center"><p className="text-sm font-medium">No customers yet</p><p className="mt-1 text-sm text-muted">Add your first customer.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">Code</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Name</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Type</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Phone</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Outstanding</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Status</th>
                <th className="microlabel px-4 py-2.5" />
              </tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                    <td className="tnum px-4 py-2.5 text-xs">{c.customer_code}</td>
                    <td className="px-4 py-2.5"><button onClick={() => navigate(`/customers/${c.id}`)} className="font-medium text-ink hover:text-leaf">{c.name}</button></td>
                    <td className="px-4 py-2.5"><Badge tone={typeTone[c.type] ?? 'default'}>{c.type}</Badge></td>
                    <td className="tnum px-4 py-2.5 text-xs text-muted">{c.phone || '—'}</td>
                    <td className="tnum px-4 py-2.5 text-right text-muted">₹{c.outstanding?.toLocaleString('en-IN') ?? 0}</td>
                    <td className="px-4 py-2.5">{c.status === 'blocked' || !can('customers.update') ? <Badge tone={c.status === 'active' ? 'active' : c.status === 'blocked' ? 'blocked' : 'inactive'}>{c.status}</Badge> : <StatusToggle active={c.status === 'active'} onToggle={(next) => onToggle(c, next)} />}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {can('customers.update') && <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Edit"><PencilSquareIcon className="size-4" /></button>}
                        {can('customers.delete') && <button onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Delete"><TrashIcon className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {!isLoading && rows.length > 0 && <div className="border-t border-line px-3"><Pagination meta={data?.meta} onPage={setPage} /></div>}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${editing.name}` : 'New customer'}
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
          <Button size="sm" disabled={saveM.isPending} onClick={() => saveM.mutate({ ...form, id: editing?.id })}>{saveM.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save'}</Button>
        </>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required error={err('name')}><Input value={form.name} onChange={set('name')} /></Field>
          <Field label="Type" required error={err('type')}>
            <select value={form.type} onChange={set('type')} className={selectCls}>
              <option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="dealer">Dealer</option>
            </select>
          </Field>
          <Field label="Code (auto if blank)" error={err('customer_code')}><Input value={form.customer_code} onChange={set('customer_code')} /></Field>
          <Field label="GST number" error={err('gst_number')}><Input value={form.gst_number} onChange={set('gst_number')} /></Field>
          <Field label="Phone" error={err('phone')}><Input value={form.phone} onChange={set('phone')} /></Field>
          <Field label="WhatsApp" error={err('whatsapp')}><Input value={form.whatsapp} onChange={set('whatsapp')} /></Field>
          <Field label="Email" error={err('email')}><Input value={form.email} onChange={set('email')} /></Field>
          <Field label="City" error={err('city')}><Input value={form.city} onChange={set('city')} /></Field>
          <Field label="State" error={err('state')}><Input value={form.state} onChange={set('state')} /></Field>
          <Field label="Credit days" error={err('credit_days')}><Input type="number" value={form.credit_days} onChange={set('credit_days')} /></Field>
          <Field label="Credit limit" error={err('credit_limit')}><Input type="number" step="0.01" value={form.credit_limit} onChange={set('credit_limit')} /></Field>
          <Field label="Opening balance" error={err('opening_balance')}><Input type="number" step="0.01" value={form.opening_balance} onChange={set('opening_balance')} /></Field>
          <div className="sm:col-span-2"><Field label="Address" error={err('address_line1')}><Input value={form.address_line1} onChange={set('address_line1')} /></Field></div>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className={selectCls}>
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option>
            </select>
          </Field>
        </div>
      </Modal>

    </div>
  );
}
