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

  // Users who signed in via OAuth (Google, etc.) don't have a password
  const provider = user.app_metadata?.provider as string | undefined;
  const isOAuthUser = !!provider && provider !== "email";

  return (
    <div className="container max-w-2xl py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Your profile</h1>
      <ProfileForm
        profile={profile}
        userEmail={user.email ?? ""}
        isOAuthUser={isOAuthUser}
      />
    </div>
  );
}
