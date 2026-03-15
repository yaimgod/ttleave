import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils/formatters";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupWithMembers = GroupRow & { group_members: { count: number }[] };

export const metadata = { title: "Manage Groups — TTLeave" };

export default async function AdminGroupsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("*, group_members(count)")
    .order("created_at", { ascending: false });

  const groups = (data ?? []) as GroupWithMembers[];

  return (
    <div className="container max-w-4xl py-6 px-4">
      <Link
        href="/admin"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Groups</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{group.name}</p>
                    {group.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {Array.isArray(group.group_members)
                    ? group.group_members.length
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(group.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
