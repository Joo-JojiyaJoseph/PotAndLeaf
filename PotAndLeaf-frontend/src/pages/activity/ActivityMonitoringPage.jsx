import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, Spinner, StatCard } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/format';

export default function ActivityMonitoringPage() {
  const { activeCompany, can, isSuperAdmin } = useAuth();
  const allowed = isSuperAdmin || can('activity.view') || can('*');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-monitoring', activeCompany?.id],
    queryFn: () => api.get('/activity-monitoring').then((r) => r.data.data),
    enabled: Boolean(activeCompany) && allowed,
    refetchInterval: 60_000,
  });

  if (!allowed) {
    return <div className="p-6 text-sm text-muted">HO Admin / Super Admin access required.</div>;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold">Activity Monitoring</h1>
        <p className="text-sm text-muted">Live snapshot across branches for {activeCompany?.name}.</p>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="size-6" /></div>
        : isError || !data ? <Card className="px-4 py-16 text-center text-sm text-muted">Couldn't load activity data.</Card>
        : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard label="Today's sales" value={formatCurrency(data.company_totals.today_sales)} />
              <StatCard label="Today's production" value={String(data.company_totals.today_production)} />
              <StatCard label="In-transit transfers" value={String(data.company_totals.in_transit_transfers)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(data.branches ?? []).map((b) => (
                <Card key={b.location_id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{b.location_name}</h2>
                      <p className="text-xs text-muted">{b.location_type}</p>
                    </div>
                    <Badge tone="active">{b.location_type}</Badge>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Today's sales</dt><dd className="tnum font-medium">{formatCurrency(b.today_sales)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted">Production today</dt><dd className="tnum font-medium">{b.today_production}</dd></div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Pending transfers</dt>
                      <dd>
                        <Link to="/transfers" className="tnum font-medium text-leaf hover:underline">{b.pending_transfers}</Link>
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold">Approvals awaiting HO</h2>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Stock counts submitted</span>
                  <Link to="/stock-verifications" className="font-medium text-leaf hover:underline">
                    {data.pending_approvals?.stock_verifications ?? 0} pending
                  </Link>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">Recent staff logins (7d)</div>
                {(data.recent_logins?.length ?? 0) === 0 ? <div className="px-4 py-10 text-center text-sm text-muted">No recent tokens.</div>
                  : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-line text-left text-faint">
                        <th className="microlabel px-4 py-2 font-semibold">User</th>
                        <th className="microlabel px-4 py-2 font-semibold">Logged at</th>
                      </tr></thead>
                      <tbody>
                        {data.recent_logins.map((u, i) => (
                          <tr key={`${u.user_id}-${i}`} className="border-b border-line/60 last:border-0">
                            <td className="px-4 py-2 font-medium">{u.user_name}</td>
                            <td className="px-4 py-2 text-muted">{formatDate(u.logged_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </Card>
            </div>
          </>
        )}
    </div>
  );
}
