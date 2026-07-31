import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Field, Input, Spinner } from '../../components/ui';
import { formatCurrency } from '../../lib/format';
import { computeSale, tierPrice } from '../../lib/saleCalc';

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = () => ({ product_id: '', qty: '1', rate: '', discount: '', gst_rate: '' });
const numInput = 'h-9 w-full rounded-[10px] border border-line bg-surface px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-leaf/30';
const selectCls = 'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/25';

export default function SaleForm() {
  const navigate = useNavigate();
  const { isSuperAdmin, companies, companyId, selectCompany, activeCompany } = useAuth();
  const [header, setHeader] = useState({ customer_id: '', location_id: '', sale_date: today(), is_interstate: false, payment_mode: 'cash', amount_paid: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sale-form-data', activeCompany?.id],
    queryFn: () => api.get('/sales/form-data').then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });
  const products = data?.products ?? [];
  const customers = data?.customers ?? [];
  const locations = data?.locations ?? [];
  const productsById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const customer = customers.find((c) => c.id === header.customer_id);
  const customerType = customer?.type ?? 'retail';

  useEffect(() => { setHeader((h) => ({ ...h, customer_id: '', location_id: '' })); setLines([emptyLine()]); setErrors({}); }, [activeCompany?.id]);
  useEffect(() => {
    if (locations.length && !header.location_id) {
      const def = locations.find((l) => l.is_default) ?? locations[0];
      setHeader((h) => ({ ...h, location_id: def.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  const computed = useMemo(() => computeSale(lines, header.is_interstate), [lines, header.is_interstate]);
  const t = computed.totals;
  const err = (k) => errors[k]?.[0];

  const setLine = (i, patch) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickProduct = (i, productId) => {
    const p = productsById[productId];
    setLine(i, { product_id: productId, rate: p ? String(tierPrice(p, customerType)) : '', gst_rate: p ? String(p.gst_rate) : '' });
  };

  async function save() {
    setErrors({});
    setSaving(true);
    try {
      const res = await api.post('/sales', {
        customer_id: header.customer_id || null,
        location_id: header.location_id || null,
        sale_date: header.sale_date,
        is_interstate: header.is_interstate,
        payment_mode: header.payment_mode,
        amount_paid: header.amount_paid === '' ? t.grand_total : Number(header.amount_paid),
        notes: header.notes || null,
        items: lines.filter((l) => l.product_id).map((l) => ({
          product_id: l.product_id, qty: Number(l.qty) || 0, rate: Number(l.rate) || 0,
          discount: Number(l.discount) || 0, gst_rate: Number(l.gst_rate) || 0,
        })),
      });
      navigate(`/sales/${res.data.data.id}`);
    } catch (e) {
      setErrors(e.response?.data?.errors ?? { _: [e.response?.data?.message ?? 'Could not save the sale.'] });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="flex h-full items-center justify-center"><Spinner className="size-6" /></div>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">New sale</h1>
          <p className="text-sm text-muted">POS billing with GST; confirm to post stock and update the customer.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/sales')}><ArrowLeftIcon className="size-4" /> Back</Button>
      </div>

      {errors._ && <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{errors._[0]}</div>}

      <Card className="p-5">
        {isSuperAdmin && (
          <div className="mb-4 rounded-xl bg-leaf-soft/50 p-3">
            <Field label="Billing for company">
              <select value={companyId ?? ''} onChange={(e) => selectCompany(e.target.value)} className={selectCls}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" error={err('customer_id')}>
            <select value={header.customer_id} onChange={(e) => setHeader((h) => ({ ...h, customer_id: e.target.value }))} className={selectCls}>
              <option value="">Walk-in</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}
            </select>
          </Field>
          <Field label="Location" error={err('location_id')}>
            <select value={header.location_id} onChange={(e) => setHeader((h) => ({ ...h, location_id: e.target.value }))} className={selectCls}>
              <option value="">Default</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Sale date" required error={err('sale_date')}>
            <Input type="date" value={header.sale_date} onChange={(e) => setHeader((h) => ({ ...h, sale_date: e.target.value }))} />
          </Field>
          <Field label="Payment mode" error={err('payment_mode')}>
            <select value={header.payment_mode} onChange={(e) => setHeader((h) => ({ ...h, payment_mode: e.target.value }))} className={selectCls}>
              <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="credit">Credit</option>
            </select>
          </Field>
          <Field label="Amount paid (blank = full)" error={err('amount_paid')}>
            <Input type="number" step="0.01" value={header.amount_paid} onChange={(e) => setHeader((h) => ({ ...h, amount_paid: e.target.value }))} placeholder={formatCurrency(t.grand_total)} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={header.is_interstate} onChange={(e) => setHeader((h) => ({ ...h, is_interstate: e.target.checked }))} className="size-4 rounded border-line text-leaf focus:ring-leaf/40" />
          Inter-state supply (charge IGST instead of CGST + SGST)
        </label>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                <th className="microlabel px-3 py-2 font-semibold">Product</th>
                <th className="microlabel px-3 py-2 text-right font-semibold">Qty</th>
                <th className="microlabel px-3 py-2 text-right font-semibold">Rate</th>
                <th className="microlabel px-3 py-2 text-right font-semibold">Disc.</th>
                <th className="microlabel px-3 py-2 text-right font-semibold">GST %</th>
                <th className="microlabel px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const p = productsById[line.product_id];
                const lt = computed.lines[i]?.line_total ?? 0;
                return (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2">
                      <select value={line.product_id} onChange={(e) => pickProduct(i, e.target.value)} className={selectCls + ' min-w-[180px]'}>
                        <option value="">Select…</option>
                        {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} · stock {pr.current_stock}</option>)}
                      </select>
                      {p && Number(line.qty) > p.current_stock && <span className="mt-1 block text-xs text-danger">Only {p.current_stock} in stock</span>}
                    </td>
                    <td className="px-3 py-2"><input type="number" step="0.001" className={numInput} value={line.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                    <td className="px-3 py-2"><input type="number" step="0.01" className={numInput} value={line.rate} onChange={(e) => setLine(i, { rate: e.target.value })} /></td>
                    <td className="px-3 py-2"><input type="number" step="0.01" className={numInput} value={line.discount} onChange={(e) => setLine(i, { discount: e.target.value })} /></td>
                    <td className="px-3 py-2"><input type="number" step="0.01" className={numInput} value={line.gst_rate} onChange={(e) => setLine(i, { gst_rate: e.target.value })} /></td>
                    <td className="tnum px-3 py-2 text-right font-medium">{formatCurrency(lt)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => setLines((pv) => (pv.length === 1 ? pv : pv.filter((_, idx) => idx !== i)))} className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-danger" aria-label="Remove"><TrashIcon className="size-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}><PlusIcon className="size-4" /> Add line</Button>
          {err('items') && <span className="ml-2 text-xs text-danger">{err('items')}</span>}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <Field label="Notes"><Input value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} placeholder="Optional" /></Field>
        </Card>
        <Card className="p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tnum">{formatCurrency(t.subtotal)}</dd></div>
            {header.is_interstate ? (
              <div className="flex justify-between"><dt className="text-muted">IGST</dt><dd className="tnum">{formatCurrency(t.tax_total)}</dd></div>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-muted">CGST</dt><dd className="tnum">{formatCurrency(t.tax_total / 2)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">SGST</dt><dd className="tnum">{formatCurrency(t.tax_total / 2)}</dd></div>
              </>
            )}
            <div className="flex justify-between text-muted"><dt>Round off</dt><dd className="tnum">{formatCurrency(t.round_off)}</dd></div>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tnum">{formatCurrency(t.grand_total)}</dd></div>
          </dl>
          <Button className="mt-4 w-full" onClick={save} disabled={saving}>{saving ? <Spinner className="border-white/40 border-t-white" /> : 'Save draft'}</Button>
        </Card>
      </div>
    </div>
  );
}
