"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface JoinGroupButtonProps {
  token: string;
  groupId: string;
}

export function JoinGroupButton({ token, groupId }: JoinGroupButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const join = async () => {
    setLoading(true);
    const res = await fetch(`/api/join/${token}`, { method: "POST" });
    if (res.ok) {
      toast.success("You joined the group!");
      router.push(`/groups/${groupId}`);
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to join");
      setLoading(false);
    }
  };

  return (
    <Button className="w-full" onClick={join} disabled={loading}>
      {loading ? "Joining…" : "Join group"}
    </Button>
  );
}
