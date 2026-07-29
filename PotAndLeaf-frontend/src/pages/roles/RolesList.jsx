import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';

const permName = (p) => (typeof p === 'string' ? p : p.name);

export default function RolesList() {
  const { activeCompany, can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selected, setSelected] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['roles', activeCompany?.id],
    queryFn: () => api.get('/roles').then((r) => r.data),
    enabled: Boolean(activeCompany),
  });

  const { data: formData } = useQuery({
    queryKey: ['roles-form-data', activeCompany?.id],
    queryFn: () => api.get('/roles/form-data').then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });

  const saveM = useMutation({
    mutationFn: (payload) => (payload.id ? api.put(`/roles/${payload.id}`, payload) : api.post('/roles', payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setEditing(null);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const deleteM = useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleting(null);
    },
  });

  const groups = formData?.permission_groups ?? {};
  const rows = data?.data ?? [];

  const openNew = () => { setForm({ name: '', description: '' }); setSelected(new Set()); setErrors({}); setEditing({}); };
  const openEdit = (r) => {
    setForm({ name: r.name, description: r.description ?? '' });
    setSelected(new Set((r.permissions ?? []).map(permName)));
    setErrors({});
    setEditing(r);
  };
  const toggle = (name) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
  const err = (k) => errors[k]?.[0];

  const save = () => saveM.mutate({ ...form, id: editing?.id, permissions: [...selected] });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Roles &amp; permissions</h1>
          <p className="text-sm text-muted">Define what each role can do in {activeCompany?.name}.</p>
        </div>
        {can('roles.create') && <Button size="sm" onClick={openNew}><PlusIcon className="size-4" /> New role</Button>}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-muted">Couldn't load roles.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">No roles yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">Role</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Description</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Permissions</th>
                <th className="microlabel px-4 py-2.5 text-right font-semibold">Users</th>
                <th className="microlabel px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                  <td className="px-4 py-2.5 font-medium">
                    {r.name}
                    {r.is_system && <span className="ml-2 rounded bg-[#F1F5F3] px-1.5 py-0.5 text-[10px] text-muted">system</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{r.description || '—'}</td>
                  <td className="tnum px-4 py-2.5 text-right text-muted">
                    {(r.permissions ?? []).map(permName).includes('*') ? 'Full' : (r.permissions?.length ?? 0)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-muted">{r.users_count ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {can('roles.update') && <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Edit"><PencilSquareIcon className="size-4" /></button>}
                      {can('roles.delete') && !r.is_system && <button onClick={() => setDeleting(r)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Delete"><TrashIcon className="size-4" /></button>}
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
        title={editing?.id ? `Edit ${editing.name}` : 'New role'}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" disabled={saveM.isPending} onClick={save}>
              {saveM.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save role'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Role name" required error={err('name')}><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Description" error={err('description')}><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        </div>

        <div className="mt-5">
          <div className="microlabel mb-2 text-faint">Permissions</div>
          <div className="space-y-4">
            {Object.entries(groups).map(([module, perms]) => (
              <div key={module} className="rounded-xl border border-line p-3">
                <div className="mb-2 text-xs font-semibold text-ink">{module}</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {Object.entries(perms).map(([name, label]) => (
                    <label key={name} className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={selected.has(name)}
                        onChange={() => toggle(name)}
                        className="size-4 rounded border-line text-leaf focus:ring-leaf/40"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {err('permissions') && <p className="mt-1 text-xs text-danger">{err('permissions')}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete role"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={deleteM.isPending} onClick={() => deleteM.mutate(deleting.id)}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-muted">Delete the <span className="font-medium text-ink">{deleting?.name}</span> role?</p>
      </Modal>
    </div>
  );
}
