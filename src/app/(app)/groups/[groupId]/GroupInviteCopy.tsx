"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Link, RefreshCw } from "lucide-react";

interface Props {
  groupId: string;
}

export function GroupInviteCopy({ groupId }: Props) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/invite`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // GET returns an array; grab the first item's invite_url if present
        const rows = Array.isArray(data) ? data : data ? [data] : [];
        setInviteUrl(rows[0]?.invite_url ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [groupId]);

  const generate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/groups/${groupId}/invite`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.invite_url);
      toast.success("Invite link generated");
    } else {
      toast.error("Failed to generate invite link");
    }
    setGenerating(false);
  };

  const copy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Link copied to clipboard");
  };

  if (loading) return null;

  if (!inviteUrl) {
    return (
      <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-1.5">
        <Link className="h-4 w-4" />
        {generating ? "Generating…" : "Generate invite link"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={inviteUrl} readOnly className="text-xs h-8 font-mono" />
      <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 shrink-0">
        <Copy className="h-4 w-4" />
        Copy
      </Button>
      <Button variant="ghost" size="sm" onClick={generate} disabled={generating} title="Regenerate" className="shrink-0">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}
