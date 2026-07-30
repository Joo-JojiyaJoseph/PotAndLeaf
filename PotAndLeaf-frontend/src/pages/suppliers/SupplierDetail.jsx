import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { Badge, Button } from '../../components/ui';
import { DetailHeader, Section, InfoGrid, InfoItem, DetailLoading, DetailError } from '../../components/detail';
import { formatCurrency } from '../../lib/format';

const tone = { active: 'active', inactive: 'inactive', blocked: 'blocked' };

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get(`/suppliers/${id}`).then((r) => r.data.data),
  });

  if (isLoading) return <DetailLoading />;
  if (isError || !data) return <DetailError backTo="/suppliers" />;
  const s = data;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <DetailHeader
        title={s.name}
        subtitle={`Supplier · ${s.supplier_code}`}
        backTo="/suppliers"
        actions={
          <>
            <Badge tone={tone[s.status] ?? 'default'}>{s.status}</Badge>
            {s.can?.update && <Button variant="outline" size="sm" onClick={() => navigate('/suppliers')}><PencilSquareIcon className="size-4" /> Edit</Button>}
          </>
        }
      />

      <Section title="Contact">
        <InfoGrid cols={3}>
          <InfoItem label="Email" value={s.email} />
          <InfoItem label="Phone" value={s.phone} mono />
          <InfoItem label="Supplier code" value={s.supplier_code} mono />
        </InfoGrid>
      </Section>

      <Section title="Tax & address">
        <InfoGrid cols={3}>
          <InfoItem label="GST number" value={s.gst_number} mono />
          <InfoItem label="PAN" value={s.pan_number} mono />
          <InfoItem label="Country" value={s.country} />
          <InfoItem label="City" value={s.city} />
          <InfoItem label="State" value={s.state} />
          <InfoItem label="Pincode" value={s.pincode} mono />
        </InfoGrid>
      </Section>

      <Section title="Banking">
        <InfoGrid cols={3}>
          <InfoItem label="Bank" value={s.bank_name} />
          <InfoItem label="Account no." value={s.bank_account_no} mono />
          <InfoItem label="IFSC" value={s.bank_ifsc} mono />
        </InfoGrid>
      </Section>

      <Section title="Terms & balances">
        <InfoGrid cols={4}>
          <InfoItem label="Credit days" value={s.credit_days} mono />
          <InfoItem label="Credit limit" value={s.credit_limit != null ? formatCurrency(s.credit_limit) : null} mono />
          <InfoItem label="Opening balance" value={s.opening_balance != null ? formatCurrency(s.opening_balance) : null} mono />
          <InfoItem label="Outstanding" value={s.outstanding != null ? formatCurrency(s.outstanding) : null} mono />
        </InfoGrid>
        {s.notes && <div className="mt-4 border-t border-line pt-4"><InfoItem label="Notes" value={s.notes} /></div>}
      </Section>
    </div>
  );
}
