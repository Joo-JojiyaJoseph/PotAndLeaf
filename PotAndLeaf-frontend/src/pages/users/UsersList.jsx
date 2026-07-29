import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';

const empty = { name: '', email: '', password: '', phone: '', role_id: '', is_active: true };
const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';

export default function UsersList() {
  const { activeCompany, can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [removing, setRemoving] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', activeCompany?.id],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: Boolean(activeCompany),
  });

  const { data: formData } = useQuery({
    queryKey: ['users-form-data', activeCompany?.id],
    queryFn: () => api.get('/users/form-data').then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });

  const saveM = useMutation({
    mutationFn: (payload) => (payload.id ? api.put(`/users/${payload.id}`, payload) : api.post('/users', payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const removeM = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setRemoving(null);
    },
  });

  const openNew = () => { setForm(empty); setErrors({}); setEditing({}); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: '', phone: u.phone ?? '', role_id: u.roles?.[0]?.id ?? '', is_active: u.is_active }); setErrors({}); setEditing(u); };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => errors[k]?.[0];

  const rows = data?.data ?? [];
  const roles = formData?.roles ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Users &amp; roles</h1>
          <p className="text-sm text-muted">Branch-level access for {activeCompany?.name}. Each user signs in with their own login.</p>
        </div>
        {can('users.create') && <Button size="sm" onClick={openNew}><PlusIcon className="size-4" /> Add user</Button>}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-muted">Couldn't load users.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">No users in this company yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">Name</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Email</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Role</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Phone</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Status</th>
                <th className="microlabel px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                  <td className="px-4 py-2.5 font-medium">
                    {u.name}
                    {u.is_super_admin && <span className="ml-2 rounded bg-leaf-soft px-1.5 py-0.5 text-[10px] font-medium text-leaf-hover">HO</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{u.email}</td>
                  <td className="px-4 py-2.5">
                    {u.roles?.length ? <Badge tone="info">{u.roles[0].name}</Badge> : <span className="text-muted">—</span>}
                  </td>
                  <td className="tnum px-4 py-2.5 text-xs text-muted">{u.phone || '—'}</td>
                  <td className="px-4 py-2.5"><Badge tone={u.is_active ? 'active' : 'inactive'}>{u.is_active ? 'active' : 'inactive'}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {can('users.update') && <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Edit"><PencilSquareIcon className="size-4" /></button>}
                      {can('users.delete') && !u.is_super_admin && <button onClick={() => setRemoving(u)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Remove"><TrashIcon className="size-4" /></button>}
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
        title={editing?.id ? `Edit ${editing.name}` : 'New user'}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" disabled={saveM.isPending} onClick={() => saveM.mutate({ ...form, id: editing?.id })}>
              {saveM.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save user'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={err('name')}><Input value={form.name} onChange={set('name')} /></Field>
          <Field label="Email" required error={err('email')}><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label={editing?.id ? 'New password (leave blank to keep)' : 'Password'} required={!editing?.id} error={err('password')}>
            <Input type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
          </Field>
          <Field label="Phone / WhatsApp" error={err('phone')}><Input value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Role" error={err('role_id')}>
            <select value={form.role_id} onChange={set('role_id')} className={selectCls}>
              <option value="">No role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.is_active ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === '1' }))} className={selectCls}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove user"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={removeM.isPending} onClick={() => removeM.mutate(removing.id)}>Remove</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Remove <span className="font-medium text-ink">{removing?.name}</span> from {activeCompany?.name}? Their login stays, but access to this company and its roles is revoked.
        </p>
      </Modal>
    </div>
  );
}
