import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Field, Input, Spinner } from '../../components/ui';

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = () => ({ product_id: '', qty: '' });
const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';
const numInput = 'h-9 w-full rounded-[10px] border border-line bg-surface px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-leaf/30';

export default function TransferForm() {
  const navigate = useNavigate();
  const { activeCompany } = useAuth();
  const [header, setHeader] = useState({ from_location_id: '', to_location_id: '', transfer_date: today(), notes: '' });
  const [lines, setLines] = useState([emptyLine()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transfer-form-data', activeCompany?.id],
    queryFn: () => api.get('/transfers/form-data').then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });
  const locations = data?.locations ?? [];
  const products = data?.products ?? [];

  useEffect(() => {
    if (locations.length && !header.from_location_id) {
      const def = locations.find((l) => l.is_default) ?? locations[0];
      const dest = locations.find((l) => l.id !== def.id);
      setHeader((h) => ({ ...h, from_location_id: def.id, to_location_id: dest?.id ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  const err = (k) => errors[k]?.[0];
  const setLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  async function save() {
    setErrors({}); setSaving(true);
    try {
      const res = await api.post('/transfers', {
        from_location_id: header.from_location_id, to_location_id: header.to_location_id,
        transfer_date: header.transfer_date, notes: header.notes || null,
        items: lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, qty: Number(l.qty) || 0 })),
      });
      navigate(`/transfers/${res.data.data.id}`);
    } catch (e) {
      setErrors(e.response?.data?.errors ?? { _: [e.response?.data?.message ?? 'Could not save transfer.'] });
    } finally { setSaving(false); }
  }

  if (isLoading) return <div className="flex h-full items-center justify-center"><Spinner className="size-6" /></div>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-semibold">New transfer</h1><p className="text-sm text-muted">Move stock from one location to another.</p></div>
        <Button variant="outline" size="sm" onClick={() => navigate('/transfers')}><ArrowLeftIcon className="size-4" /> Back</Button>
      </div>

      {errors._ && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{errors._[0]}</div>}

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="From" required error={err('from_location_id')}>
            <select value={header.from_location_id} onChange={(e) => setHeader((h) => ({ ...h, from_location_id: e.target.value }))} className={selectCls}>
              <option value="">Select…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="To" required error={err('to_location_id')}>
            <select value={header.to_location_id} onChange={(e) => setHeader((h) => ({ ...h, to_location_id: e.target.value }))} className={selectCls}>
              <option value="">Select…</option>
              {locations.filter((l) => l.id !== header.from_location_id).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Date" required error={err('transfer_date')}><Input type="date" value={header.transfer_date} onChange={(e) => setHeader((h) => ({ ...h, transfer_date: e.target.value }))} /></Field>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-faint">
            <th className="microlabel px-3 py-2 font-semibold">Product</th>
            <th className="microlabel px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-3 py-2" />
          </tr></thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2">
                  <select value={line.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })} className={selectCls}>
                    <option value="">Select…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ''}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input type="number" step="0.001" className={numInput} value={line.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                <td className="px-3 py-2"><button onClick={() => setLines((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)))} className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Remove"><TrashIcon className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}><PlusIcon className="size-4" /> Add product</Button>
          {err('items') && <span className="ml-2 text-xs text-danger">{err('items')}</span>}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Input value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} placeholder="Notes (optional)" className="max-w-xs" />
        <Button onClick={save} disabled={saving}>{saving ? <Spinner className="border-white/40 border-t-white" /> : 'Save draft'}</Button>
      </div>
    </div>
  );
}
