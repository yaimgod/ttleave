import { createClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/shared/StatsCard";
import { Users, Timer, Layers } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin — TTLeave" };

export default async function AdminPage() {
  const supabase = await createClient();

  const [{ count: userCount }, { count: eventCount }, { count: groupCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("groups")
        .select("id", { count: "exact", head: true }),
    ]);

  return (
    <div className="container max-w-4xl py-6 px-4">
      <h1 className="mb-6 text-2xl font-bold">Admin Panel</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatsCard title="Total users" value={userCount ?? 0} icon={Users} />
        <StatsCard title="Total events" value={eventCount ?? 0} icon={Timer} />
        <StatsCard title="Total groups" value={groupCount ?? 0} icon={Layers} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/admin/users" className="gap-2">
            <Users className="h-4 w-4" />
            Manage users
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/groups" className="gap-2">
            <Layers className="h-4 w-4" />
            Manage groups
          </Link>
        </Button>
      </div>
    </div>
  );
}
