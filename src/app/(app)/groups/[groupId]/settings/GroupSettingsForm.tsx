"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings2, Users } from "lucide-react";

interface GroupSettingsFormProps {
  groupId: string;
  initialName: string;
  initialDescription: string | null;
  initialDefaultPermissions: "view_only" | "view_comment" | "can_adjust";
}

const permissionLabels: Record<string, string> = {
  view_only: "View only",
  view_comment: "View & comment",
  can_adjust: "Can adjust dates",
};

export function GroupSettingsForm({
  groupId,
  initialName,
  initialDescription,
  initialDefaultPermissions,
}: GroupSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [defaultPermissions, setDefaultPermissions] = useState(
    initialDefaultPermissions
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          default_member_permissions: defaultPermissions,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save settings");
      } else {
        toast.success("Settings saved");
        router.refresh();
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            Group details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="What is this group for?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default-permissions" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Default permission for new members
              </Label>
              <Select
                value={defaultPermissions}
                onValueChange={(v) =>
                  setDefaultPermissions(
                    v as "view_only" | "view_comment" | "can_adjust"
                  )
                }
              >
                <SelectTrigger id="default-permissions">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(permissionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applied automatically when someone joins via invite link.
              </p>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
