import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-utils';
import { getPermissionPath } from '@/lib/route-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
);

export type ApiUser = {
  id: string;
  role: string;
  permissions: string[];
  restrict_admin_permissions: boolean;
};

export async function getApiUser(): Promise<ApiUser | null> {
  const token = (await cookies()).get('auth_token')?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  const userId = payload?.userId as string | undefined;
  if (!userId) return null;

  const { data } = await supabase
    .from('users')
    .select('id, role, permissions, restrict_admin_permissions')
    .eq('id', userId)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    role: data.role,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    restrict_admin_permissions: Boolean(data.restrict_admin_permissions),
  };
}

export function hasApiPathAccess(user: ApiUser, path: string, extraRoles: string[] = []) {
  if (user.role === 'admin' && !user.restrict_admin_permissions) return true;
  if (extraRoles.includes(user.role)) return true;

  const pathname = path.split('?')[0].split('#')[0];
  const permissionPath = getPermissionPath(pathname);
  if (permissionPath) return user.permissions.includes(permissionPath);

  return user.permissions.some(permission =>
    permission !== '/dashboard' && (pathname === permission || pathname.startsWith(permission + '/'))
  );
}
