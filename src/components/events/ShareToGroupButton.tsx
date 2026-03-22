"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  eventId: string;
  currentGroupId: string | null;
  currentGroupName: string | null;
  groups: Array<{ id: string; name: string }>;
}

export function ShareToGroupButton({
  eventId,
  currentGroupId,
  currentGroupName,
  groups,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>(currentGroupId ?? "");
  const [loading, setLoading] = useState(false);

  const isShared = !!currentGroupId;

  async function share() {
    if (!selectedGroup) return;
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: selectedGroup }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Event shared with group");
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Failed to share");
    }
  }

  async function unshare() {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/share`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      toast.success("Event removed from group");
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Failed to unshare");
    }
  }

  if (groups.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isShared ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title={isShared ? `Shared with ${currentGroupName}` : "Share to group"}
        >
          <Users className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <p className="text-sm font-semibold">Share to group</p>

        {isShared ? (
          <>
            <p className="text-xs text-muted-foreground">
              Shared with <span className="font-medium text-foreground">{currentGroupName}</span>.
              Members can view, track progress, and comment.
            </p>
            <div className="flex gap-2">
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={share}
                disabled={loading || selectedGroup === currentGroupId}
              >
                Move
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs text-destructive hover:text-destructive"
              onClick={unshare}
              disabled={loading}
            >
              <X className="mr-1 h-3 w-3" />
              Remove from group
            </Button>
          </>
        ) : (
          <>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a group…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Members can view, track progress, and comment — but cannot change the date.
            </p>
            <Button
              size="sm"
              className="h-8 w-full text-xs"
              onClick={share}
              disabled={loading || !selectedGroup}
            >
              <Share2 className="mr-1 h-3 w-3" />
              Share
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
