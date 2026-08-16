export interface MinimalSession {
  user?: {
    app_metadata?: { role?: string };
    user_metadata?: { role?: string };
  };
}

interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

const ADMIN_ROLE_LEVELS: Record<string, number> = {
  borrower: 0,
  user: 0,
  support: 1,
  admin: 2,
  base_admin: 2,
  super_admin: 3,
  owner: 4
};

export function hasMinimumRole(role: string, minimumRole = 'base_admin'): boolean {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedMinimum = String(minimumRole || 'base_admin').trim().toLowerCase();
  const roleLevel = ADMIN_ROLE_LEVELS[normalizedRole] ?? 0;
  const minimumLevel = ADMIN_ROLE_LEVELS[normalizedMinimum] ?? 2;
  return roleLevel >= minimumLevel;
}

export async function resolveAdminAccess(
  session: MinimalSession | null,
  client: RpcClient,
  minimumRole = 'base_admin'
): Promise<boolean> {
  const jwtRole = session?.user?.app_metadata?.role || '';
  if (jwtRole && hasMinimumRole(jwtRole, minimumRole)) {
    return true;
  }

  const { data: rpcAllowed, error: rpcError } = await client.rpc('is_role_or_higher', {
    p_min_role: minimumRole
  });

  if (!rpcError) {
    return Boolean(rpcAllowed);
  }

  return false;
}
