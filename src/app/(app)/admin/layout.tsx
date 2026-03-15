import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ProfileRole = Pick<Database["public"]["Tables"]["profiles"]["Row"], "role"> | null;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = data as ProfileRole;
  if (profile?.role !== "admin") redirect("/dashboard");

  return <>{children}</>;
}
