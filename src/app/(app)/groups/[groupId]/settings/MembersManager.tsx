"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Users, Trash2 } from "lucide-react";

export interface MemberItem {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  memberPermissions: "view_only" | "view_comment" | "can_adjust";
}

interface MembersManagerProps {
  groupId: string;
  members: MemberItem[];
  currentUserId: string;
  isOwner: boolean;
}

const permissionLabels: Record<string, string> = {
  view_only: "View only",
  view_comment: "View & comment",
  can_adjust: "Can adjust",
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function MembersManager({
  groupId,
  members,
  currentUserId,
  isOwner,
}: MembersManagerProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (userId: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from the group?`)) return;
    setRemoving(userId);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success(`${displayName} removed`);
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to remove member");
      }
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Members ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((m) => {
          const displayName = m.name ?? m.email;
          const initials = getInitials(m.name, m.email);
          const canRemove = isOwner && m.userId !== currentUserId;

          return (
            <div
              key={m.userId}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={m.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-none">
                    {displayName}
                  </p>
                  {m.name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={m.role === "owner" ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {m.role === "owner" ? "Owner" : "Member"}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {permissionLabels[m.memberPermissions] ?? m.memberPermissions}
                </Badge>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={removing === m.userId}
                    onClick={() => handleRemove(m.userId, displayName)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove {displayName}</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
