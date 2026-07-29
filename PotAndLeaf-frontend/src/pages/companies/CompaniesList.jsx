import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BuildingOffice2Icon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';

const empty = { name: '', code: '', gst_number: '', state: '', state_code: '', phone: '', email: '', address: '', is_active: true };
const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';

export default function CompaniesList() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get('/companies').then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const saveM = useMutation({
    mutationFn: (payload) =>
      payload.id ? api.put(`/companies/${payload.id}`, payload) : api.post('/companies', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setEditing(null);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const deleteM = useMutation({
    mutationFn: (id) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleting(null);
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Card className="p-10 text-center text-sm text-muted">
          Company management is available to HO super admins only.
        </Card>
      </div>
    );
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
          <h1 className="text-lg font-semibold">Companies</h1>
          <p className="text-sm text-muted">HO super-admin control over every company in the group.</p>
        </div>
        <Button size="sm" onClick={openNew}><PlusIcon className="size-4" /> Add company</Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-muted">Couldn't load companies.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">No companies yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">Code</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Name</th>
                <th className="microlabel px-4 py-2.5 font-semibold">GST</th>
                <th className="microlabel px-4 py-2.5 font-semibold">State</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Users</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Status</th>
                <th className="microlabel px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                  <td className="tnum px-4 py-2.5 text-xs">{c.code}</td>
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="tnum px-4 py-2.5 text-xs text-muted">{c.gst_number || '—'}</td>
                  <td className="px-4 py-2.5 text-muted">{c.state || '—'}</td>
                  <td className="tnum px-4 py-2.5 text-right text-muted">{c.users_count ?? '—'}</td>
                  <td className="px-4 py-2.5"><Badge tone={c.is_active ? 'active' : 'inactive'}>{c.is_active ? 'active' : 'inactive'}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Edit"><PencilSquareIcon className="size-4" /></button>
                      <button onClick={() => setDeleting(c)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Delete"><TrashIcon className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${editing.name}` : 'Add company'}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" disabled={saveM.isPending} onClick={() => saveM.mutate({ ...form, id: editing?.id })}>
              {saveM.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required error={err('name')}><Input value={form.name} onChange={set('name')} /></Field>
          <Field label="Code" required error={err('code')}><Input value={form.code} onChange={set('code')} placeholder="CHK-XXX" /></Field>
          <Field label="GST number" error={err('gst_number')}><Input value={form.gst_number} onChange={set('gst_number')} /></Field>
          <Field label="Legal name" error={err('legal_name')}><Input value={form.legal_name ?? ''} onChange={set('legal_name')} /></Field>
          <Field label="State" error={err('state')}><Input value={form.state} onChange={set('state')} /></Field>
          <Field label="State code" error={err('state_code')}><Input value={form.state_code} onChange={set('state_code')} placeholder="32" /></Field>
          <Field label="Phone" error={err('phone')}><Input value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email" error={err('email')}><Input value={form.email} onChange={set('email')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Address" error={err('address')}><Input value={form.address} onChange={set('address')} /></Field>
          </div>
          <Field label="Status">
            <select value={form.is_active ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === '1' }))} className={selectCls}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete company"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={deleteM.isPending} onClick={() => deleteM.mutate(deleting.id)}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Delete <span className="font-medium text-ink">{deleting?.name}</span>? Its data is soft-deleted and can be restored by a developer.
        </p>
      </Modal>
    </div>
  );
}
