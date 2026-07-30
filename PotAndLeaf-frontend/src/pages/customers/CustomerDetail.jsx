import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button } from '../../components/ui';
import { DetailHeader, Section, InfoGrid, InfoItem, DetailLoading, DetailError } from '../../components/detail';
import { formatCurrency } from '../../lib/format';

const typeTone = { retail: 'info', wholesale: 'active', dealer: 'pending' };
const statusTone = { active: 'active', inactive: 'inactive', blocked: 'blocked' };

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompany, can } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer', activeCompany?.id, id],
    queryFn: () => api.get(`/customers/${id}`).then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });

  if (isLoading) return <DetailLoading />;
  if (isError || !data) return <DetailError backTo="/customers" />;
  const c = data;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <DetailHeader
        title={c.name}
        subtitle={`Customer · ${c.customer_code}`}
        backTo="/customers"
        actions={
          <>
            <Badge tone={typeTone[c.type] ?? 'default'}>{c.type}</Badge>
            <Badge tone={statusTone[c.status] ?? 'default'}>{c.status}</Badge>
            {can('customers.update') && <Button variant="outline" size="sm" onClick={() => navigate('/customers')}><PencilSquareIcon className="size-4" /> Edit</Button>}
          </>
        }
      />

      <Section title="Contact">
        <InfoGrid cols={3}>
          <InfoItem label="Phone" value={c.phone} mono />
          <InfoItem label="WhatsApp" value={c.whatsapp} mono />
          <InfoItem label="Email" value={c.email} />
          <InfoItem label="GST number" value={c.gst_number} mono />
          <InfoItem label="City" value={c.city} />
          <InfoItem label="State" value={c.state} />
        </InfoGrid>
        {(c.address_line1 || c.address_line2) && (
          <div className="mt-4 border-t border-line pt-4">
            <InfoItem label="Address" value={[c.address_line1, c.address_line2, c.pincode].filter(Boolean).join(', ')} />
          </div>
        )}
      </Section>

      <Section title="Terms & balances">
        <InfoGrid cols={4}>
          <InfoItem label="Credit days" value={c.credit_days} mono />
          <InfoItem label="Credit limit" value={formatCurrency(c.credit_limit)} mono />
          <InfoItem label="Opening balance" value={formatCurrency(c.opening_balance)} mono />
          <InfoItem label="Outstanding" value={formatCurrency(c.outstanding)} mono />
          <InfoItem label="Loyalty points" value={c.loyalty_points} mono />
        </InfoGrid>
        {c.notes && <div className="mt-4 border-t border-line pt-4"><InfoItem label="Notes" value={c.notes} /></div>}
      </Section>
    </div>
  );
}
