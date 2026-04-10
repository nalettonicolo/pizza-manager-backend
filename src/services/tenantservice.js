import { supabase } from "@/lib/supabaseClient.js"

export const createTenant = async (nome, slug, userId) => {
  const { data: tenant, error } = await supabase
    .from("pm_tenants")
    .insert([{ nome, slug }])
    .select()
    .single();

  if (error) return { error };

  await supabase.from("user_tenants").insert([
    {
      user_id: userId,
      tenant_id: tenant.id,
      ruolo: "owner"
    }
  ]);

  return { tenant };
};
