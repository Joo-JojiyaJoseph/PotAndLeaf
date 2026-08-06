import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import useCompanyFilter from '../../hooks/useCompanyFilter';
import { Badge, Button, Card, Field, Input, Modal, Spinner } from '../../components/ui';

const TABS = [
  { type: 'categories', label: 'Categories', singular: 'category', hasParent: true },
  { type: 'brands', label: 'Brands', singular: 'brand' },
  { type: 'units', label: 'Units', singular: 'unit', hasShort: true },
];
const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';

function MasterModal({ open, onClose, tab, editing, filterCompanyId, companyParams }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', short_name: '', description: '', parent_id: '', status: 'active' });
  const [errors, setErrors] = useState({});
  const [applied, setApplied] = useState(null);

  // seed the form when the modal opens for a given row (or new)
  const key = editing?.id ?? 'new';
  if (open && applied !== key) {
    setForm(editing
      ? { name: editing.name ?? '', code: editing.code ?? '', short_name: editing.short_name ?? '', description: editing.description ?? '', parent_id: editing.parent_id ?? '', status: editing.status ?? 'active' }
      : { name: '', code: '', short_name: '', description: '', parent_id: '', status: 'active' });
    setApplied(key); setErrors({});
  }

  // parents for the category dropdown
  const parentsQ = useQuery({
    queryKey: ['masters', 'categories', 'parents', filterCompanyId],
    queryFn: () => api.get('/masters/categories', { params: companyParams }).then((r) => r.data.data),
    enabled: open && Boolean(tab.hasParent),
  });

  const saveM = useMutation({
    mutationFn: () => {
      const payload = { name: form.name, code: form.code || null, description: form.description || null, status: form.status };
      if (tab.hasShort) payload.short_name = form.short_name || null;
      if (tab.hasParent) payload.parent_id = form.parent_id || null;
      return editing ? api.put(`/masters/${tab.type}/${editing.id}`, payload) : api.post(`/masters/${tab.type}`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['masters', tab.type] }); handleClose(); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  function handleClose() { setApplied(null); setErrors({}); onClose(); }
  const err = (k) => errors[k]?.[0];

  return (
    <Modal open={open} onClose={handleClose} title={`${editing ? 'Edit' : 'New'} ${tab.singular}`}
      footer={<>
        <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
        <Button size="sm" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? <Spinner className="border-white/40 border-t-white" /> : 'Save'}</Button>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required error={err('name')}><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Code" error={err('code')}><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
        {tab.hasShort && <Field label="Short name" error={err('short_name')}><Input value={form.short_name} onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))} placeholder="e.g. kg, pc" /></Field>}
        {tab.hasParent && (
          <Field label="Parent category" error={err('parent_id')}>
            <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))} className={selectCls}>
              <option value="">None</option>
              {(parentsQ.data ?? []).filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={selectCls}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={err('description')}><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export default function MastersPage() {
  const { activeCompany, can } = useAuth();
  const { filterCompanyId, companyParams, companyHint, Filter } = useCompanyFilter();
  const queryClient = useQueryClient();
  const [tabType, setTabType] = useState('categories');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const tab = TABS.find((t) => t.type === tabType);

  const { data, isLoading } = useQuery({
    queryKey: ['masters', tabType, activeCompany?.id, filterCompanyId],
    queryFn: () => api.get(`/masters/${tabType}`, { params: companyParams }).then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });
  const deleteM = useMutation({
    mutationFn: (id) => api.delete(`/masters/${tabType}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['masters', tabType] }),
  });
  const rows = data ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Product masters</h1>
          <p className="text-sm text-muted">Manage the categories, brands and units your products use{companyHint}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter />
          {can(`${tabType}.create`) && <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}><PlusIcon className="size-4" /> New {tab.singular}</Button>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.type} onClick={() => setTabType(t.type)}
            className={'border-b-2 px-3 py-2 text-sm transition-colors ' + (tabType === t.type ? 'border-leaf font-medium text-leaf' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
          : rows.length === 0 ? <div className="px-4 py-16 text-center"><p className="text-sm font-medium">No {tab.label.toLowerCase()} yet</p><p className="mt-1 text-sm text-muted">Add one to use it on products.</p></div>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-4 py-2.5 font-semibold">Name</th>
                <th className="microlabel px-4 py-2.5 font-semibold">Code</th>
                {tab.hasShort && <th className="microlabel px-4 py-2.5 font-semibold">Short</th>}
                {tab.hasParent && <th className="microlabel px-4 py-2.5 font-semibold">Parent</th>}
                <th className="microlabel px-4 py-2.5 font-semibold">Status</th>
                <th className="microlabel px-4 py-2.5" />
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-sidebar/60">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted">{r.code || '—'}</td>
                    {tab.hasShort && <td className="px-4 py-2.5 text-muted">{r.short_name || '—'}</td>}
                    {tab.hasParent && <td className="px-4 py-2.5 text-muted">{r.parent_name || '—'}</td>}
                    <td className="px-4 py-2.5"><Badge tone={r.status === 'active' ? 'active' : 'inactive'}>{r.status}</Badge></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {can(`${tabType}.update`) && <button onClick={() => { setEditing(r); setModalOpen(true); }} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink"><PencilSquareIcon className="size-4" /></button>}
                        {can(`${tabType}.delete`) && <button onClick={() => deleteM.mutate(r.id)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-danger"><TrashIcon className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>

      <MasterModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} tab={tab} editing={editing} filterCompanyId={filterCompanyId} companyParams={companyParams} />
    </div>
  );
}
