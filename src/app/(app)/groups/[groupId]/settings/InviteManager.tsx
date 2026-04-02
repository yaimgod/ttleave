"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, Link2 } from "lucide-react";

interface InviteData {
  token: string;
  invite_url: string;
  use_count: number;
  expires_at: string | null;
}

interface InviteManagerProps {
  groupId: string;
  initialInvite: InviteData | null;
}

export function InviteManager({ groupId, initialInvite }: InviteManagerProps) {
  const [invite, setInvite] = useState<InviteData | null>(initialInvite);
  const [loading, setLoading] = useState(false);

  const generateInvite = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setInvite(data);
        toast.success("Invite link generated");
      } else {
        toast.error("Failed to generate invite");
      }
    } catch {
      toast.error("Failed to generate invite");
    } finally {
      setLoading(false);
    }
  };

  const revokeInvite = async () => {
    await fetch(`/api/groups/${groupId}/invite`, { method: "DELETE" });
    setInvite(null);
    toast.success("Invite revoked");
  };

  const copyLink = () => {
    if (invite) {
      navigator.clipboard.writeText(invite.invite_url);
      toast.success("Invite link copied");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Invite link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invite ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={invite.invite_url}
                className="text-xs font-mono"
              />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Used {invite.use_count} times</span>
              {invite.expires_at && (
                <span>
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={generateInvite}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={revokeInvite}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No active invite link. Generate one to share with others.
            </p>
            <Button
              onClick={generateInvite}
              disabled={loading}
              size="sm"
              className="gap-1.5"
            >
              <Link2 className="h-4 w-4" />
              {loading ? "Generating…" : "Generate invite link"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
