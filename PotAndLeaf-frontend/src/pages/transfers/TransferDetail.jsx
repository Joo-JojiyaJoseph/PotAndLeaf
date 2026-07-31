import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, PaperAirplaneIcon, XCircleIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { Badge, Button, Modal } from '../../components/ui';
import { DetailHeader, Section, InfoGrid, InfoItem, DetailLoading, DetailError } from '../../components/detail';
import { formatDate } from '../../lib/format';

const tone = { draft: 'inactive', in_transit: 'warning', received: 'active', cancelled: 'blocked' };

export default function TransferDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [receiving, setReceiving] = useState(false);
  const [receipts, setReceipts] = useState({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => api.get(`/transfers/${id}`).then((r) => r.data.data),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transfer', id] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
  const dispatchM = useMutation({ mutationFn: () => api.post(`/transfers/${id}/dispatch`), onSuccess: invalidate });
  const cancelM = useMutation({ mutationFn: () => api.delete(`/transfers/${id}`), onSuccess: invalidate });
  const receiveM = useMutation({
    mutationFn: () => api.post(`/transfers/${id}/receive`, { receipts: Object.entries(receipts).map(([itemId, q]) => ({ id: itemId, received_qty: Number(q) || 0 })) }),
    onSuccess: () => { invalidate(); setReceiving(false); },
  });

  if (isLoading) return <DetailLoading />;
  if (isError || !data) return <DetailError backTo="/transfers" />;
  const t = data;

  const openReceive = () => {
    const seed = {};
    (t.items ?? []).forEach((it) => { seed[it.id] = String(it.qty); });
    setReceipts(seed); setReceiving(true);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <DetailHeader
        title={`Transfer ${t.transfer_no}`}
        subtitle={`${t.from_location} → ${t.to_location} · ${formatDate(t.transfer_date)}`}
        backTo="/transfers"
        actions={<>
          <Badge tone={tone[t.status] ?? 'default'}>{t.status.replace('_', ' ')}</Badge>
          {t.can?.cancel && <Button variant="ghost" size="sm" onClick={() => cancelM.mutate()} disabled={cancelM.isPending}><XCircleIcon className="size-4" /> Cancel</Button>}
          {t.can?.dispatch && <Button variant="outline" size="sm" onClick={() => dispatchM.mutate()} disabled={dispatchM.isPending}><PaperAirplaneIcon className="size-4" /> Dispatch</Button>}
          {t.can?.receive && <Button size="sm" onClick={openReceive}><CheckCircleIcon className="size-4" /> Receive</Button>}
        </>}
      />

      <Section title="Details">
        <InfoGrid cols={4}>
          <InfoItem label="From" value={t.from_location} />
          <InfoItem label="To" value={t.to_location} />
          <InfoItem label="Dispatched" value={t.dispatched_at ? formatDate(t.dispatched_at) : null} />
          <InfoItem label="Received" value={t.received_at ? formatDate(t.received_at) : null} />
          <InfoItem label="Notes" value={t.notes} />
        </InfoGrid>
      </Section>

      <Section title="Items">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-faint">
            <th className="microlabel py-2 pr-3 font-semibold">Product</th>
            <th className="microlabel px-3 py-2 text-right font-semibold">Sent</th>
            <th className="microlabel py-2 pl-3 text-right font-semibold">Received</th>
          </tr></thead>
          <tbody>
            {(t.items ?? []).map((it) => (
              <tr key={it.id} className="border-b border-line/60 last:border-0">
                <td className="py-2 pr-3 font-medium">{it.product_name}</td>
                <td className="tnum px-3 py-2 text-right text-muted">{it.qty}</td>
                <td className="tnum py-2 pl-3 text-right font-medium">{t.status === 'received' ? it.received_qty : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Modal open={receiving} onClose={() => setReceiving(false)} title={`Receive ${t.transfer_no}`}
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setReceiving(false)}>Cancel</Button>
          <Button size="sm" disabled={receiveM.isPending} onClick={() => receiveM.mutate()}>Confirm receipt</Button>
        </>}
      >
        <p className="mb-3 text-sm text-muted">Enter the quantity actually received at {t.to_location}. Any shortfall returns to {t.from_location}.</p>
        <div className="space-y-2">
          {(t.items ?? []).map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{it.product_name} <span className="text-xs text-muted">(sent {it.qty})</span></span>
              <input type="number" step="0.001" max={it.qty} value={receipts[it.id] ?? ''} onChange={(e) => setReceipts((r) => ({ ...r, [it.id]: e.target.value }))}
                className="h-9 w-28 rounded-[10px] border border-line bg-surface px-2 text-right text-sm tabular-nums" />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
