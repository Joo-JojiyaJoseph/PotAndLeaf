import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { Badge, Button } from '../../components/ui';
import { DetailHeader, Section, InfoGrid, InfoItem, DetailLoading, DetailError } from '../../components/detail';
import { formatCurrency, formatDate } from '../../lib/format';

const statusTone = { draft: 'inactive', completed: 'active', cancelled: 'blocked' };

export default function ProductionOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['production-order', id],
    queryFn: () => api.get(`/production/orders/${id}`).then((r) => r.data.data),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-order', id] });
    queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
  const completeM = useMutation({ mutationFn: () => api.post(`/production/orders/${id}/complete`), onSuccess: invalidate });
  const cancelM = useMutation({ mutationFn: () => api.delete(`/production/orders/${id}`), onSuccess: invalidate });

  if (isLoading) return <DetailLoading />;
  if (isError || !data) return <DetailError backTo="/production" />;
  const o = data;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <DetailHeader
        title={`Production ${o.order_no}`}
        subtitle={`${o.output_quantity} × ${o.output_product} · ${formatDate(o.order_date)}`}
        backTo="/production"
        actions={<>
          <Badge tone={statusTone[o.status] ?? 'default'}>{o.status}</Badge>
          {o.can?.cancel && <Button variant="ghost" size="sm" onClick={() => cancelM.mutate()} disabled={cancelM.isPending}><XCircleIcon className="size-4" /> Cancel</Button>}
          {o.can?.complete && <Button size="sm" onClick={() => completeM.mutate()} disabled={completeM.isPending}><CheckCircleIcon className="size-4" /> Complete</Button>}
        </>}
      />

      <Section title="Details">
        <InfoGrid cols={4}>
          <InfoItem label="Recipe" value={o.bom_name} />
          <InfoItem label="Output product" value={o.output_product} />
          <InfoItem label="Output quantity" value={o.output_quantity} />
          <InfoItem label="Unit cost" value={o.status === 'completed' ? formatCurrency(o.output_unit_cost) : '—'} mono />
          <InfoItem label="Total input cost" value={o.status === 'completed' ? formatCurrency(o.total_input_cost) : '—'} mono />
          <InfoItem label="Completed" value={o.completed_at ? formatDate(o.completed_at) : null} />
          <InfoItem label="Notes" value={o.notes} />
        </InfoGrid>
      </Section>

      {o.status === 'completed' && (o.items?.length ?? 0) > 0 && (
        <Section title="Materials consumed">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-faint">
              <th className="microlabel py-2 pr-3 font-semibold">Component</th>
              <th className="microlabel px-3 py-2 text-right font-semibold">Qty</th>
              <th className="microlabel px-3 py-2 text-right font-semibold">Unit cost</th>
              <th className="microlabel py-2 pl-3 text-right font-semibold">Line cost</th>
            </tr></thead>
            <tbody>
              {o.items.map((it) => (
                <tr key={it.id} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3 font-medium">{it.product_name}</td>
                  <td className="tnum px-3 py-2 text-right text-muted">{it.qty}</td>
                  <td className="tnum px-3 py-2 text-right text-muted">{formatCurrency(it.unit_cost)}</td>
                  <td className="tnum py-2 pl-3 text-right font-medium">{formatCurrency(it.line_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
