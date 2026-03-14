import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Groups — TTLeave" };

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(id, name, description, created_at)")
    .eq("user_id", user!.id)
    .order("joined_at", { ascending: false });

  const groups = (memberships ?? []).map((m) => ({
    ...(m.groups as { id: string; name: string; description: string | null; created_at: string }),
    memberRole: m.role,
  }));

  return (
    <div className="container max-w-4xl py-6 px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/groups/new">
            <Plus className="h-4 w-4" />
            New group
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a group or join one via an invite link."
          action={
            <Button asChild>
              <Link href="/groups/new">Create group</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.memberRole === "owner" && (
                      <Badge variant="secondary" className="text-xs">Owner</Badge>
                    )}
                  </div>
                </CardHeader>
                {group.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {group.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
