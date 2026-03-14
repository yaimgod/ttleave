import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";
import { JoinGroupButton } from "./JoinGroupButton";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}) {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("group_invites")
    .select("groups(name)")
    .eq("token", params.token)
    .single();
  const name = (data?.groups as { name: string } | null)?.name ?? "a group";
  return { title: `Join ${name} — TTLeave` };
}

export default async function JoinPage({
  params,
}: {
  params: { token: string };
}) {
  const serviceSupabase = await createServiceClient();
  const { data: invite } = await serviceSupabase
    .from("group_invites")
    .select("*, groups(id, name, description)")
    .eq("token", params.token)
    .single();

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Invite not found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              This invite link is invalid or has expired.
            </p>
            <Button asChild>
              <Link href="/dashboard">Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const group = invite.groups as {
    id: string;
    name: string;
    description: string | null;
  } | null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You&apos;ve been invited!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div>
            <p className="font-semibold text-lg">{group?.name}</p>
            {group?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {group.description}
              </p>
            )}
          </div>

          {user ? (
            <JoinGroupButton token={params.token} groupId={group!.id} />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Sign in to join this group.
              </p>
              <Button asChild className="w-full">
                <Link href={`/login?redirectTo=/join/${params.token}`}>
                  Sign in to join
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/signup?redirectTo=/join/${params.token}`}>
                  Create account
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
