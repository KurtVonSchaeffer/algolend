import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/apiClient';

interface EligibilityResponse {
  eligible: boolean;
  reason?: string;
}

async function fetchEligibility(): Promise<EligibilityResponse> {
  const response = await apiFetch('/api/my-eligibility');
  if (!response.ok) throw new Error(`Failed to load eligibility (${response.status})`);
  return response.json();
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-eligibility'],
    queryFn: fetchEligibility
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-black text-gray-900">Dashboard</h1>
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Could not load your eligibility.</p>}
      {data && (
        <p className="text-sm text-gray-700">
          {data.eligible ? 'You are eligible for a loan.' : `Not yet eligible (${data.reason ?? 'unknown reason'}).`}
        </p>
      )}
    </div>
  );
}
