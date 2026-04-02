import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) notFound();

  return (
    <div className="container max-w-2xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Your profile</h1>
      <ProfileForm profile={profile} userEmail={user.email ?? ""} />
    </div>
  );
}
