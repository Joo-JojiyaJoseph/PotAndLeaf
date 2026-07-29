import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, Spinner, StatCard } from '../components/ui';
import { formatDate } from '../lib/format';

export default function Dashboard() {
  const { activeCompany } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', activeCompany?.id],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
    enabled: Boolean(activeCompany),
  });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">
            {activeCompany ? activeCompany.name : 'Select a company'} · overview
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : isError ? (
        <Card className="p-6 text-sm text-muted">
          Couldn't load the dashboard. Check that the API is running and a company is selected.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(data?.cards ?? []).map((card) => (
              <StatCard
                key={card.key}
                label={card.label}
                value={card.value}
                tone={card.tone === 'warning' ? 'warn' : 'good'}
              />
            ))}
          </div>

          <Card>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Live activity</h2>
              <p className="text-xs text-muted">Recent events across this company's branches.</p>
            </div>
            {(data?.activity ?? []).length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 text-sm text-muted">
                  Purchases, sales and transfers will appear here once those modules are live.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">Branch</th>
                    <th className="px-4 py-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.map((row, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-muted">
                        {formatDate(row.time)}
                      </td>
                      <td className="px-4 py-2">{row.event}</td>
                      <td className="px-4 py-2 text-muted">{row.branch}</td>
                      <td className="tnum px-4 py-2 text-right">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
