"use client";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  groupId: string;
  initialEnabled: boolean;
}

export function NotificationToggle({ groupId, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  const toggle = async (value: boolean) => {
    setSaving(true);
    setEnabled(value);
    const res = await fetch(`/api/groups/${groupId}/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: value }),
    });
    if (!res.ok) {
      setEnabled(!value);
      toast.error("Failed to update notification preference");
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Switch id="notif-toggle" checked={enabled} onCheckedChange={toggle} disabled={saving} />
      <Label htmlFor="notif-toggle" className="text-sm cursor-pointer">
        Email notifications for this group
      </Label>
    </div>
  );
}
