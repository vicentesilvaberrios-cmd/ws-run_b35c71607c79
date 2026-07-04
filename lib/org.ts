import { createClient } from '@/lib/supabase/server';

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

/**
 * Gets the current user's organization based on their membership.
 * Returns null if the user is not authenticated or has no membership.
 */
export async function getCurrentOrg(): Promise<OrgInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (!membership?.org_id) return null;

  // Fetch the org details (RLS: is_member check passes)
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', membership.org_id)
    .single();

  if (!org) return null;

  return org as unknown as OrgInfo;
}

/**
 * Gets the org_id for the current user. Throws if not authenticated.
 */
export async function requireOrgId(): Promise<string> {
  const org = await getCurrentOrg();
  if (!org) throw new Error('No organization found for current user');
  return org.id;
}
