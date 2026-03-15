"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";

export function useGroupMembership(groupId?: string) {
  const { user } = useAuth();
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !groupId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const row = data as { role: string } | null;
        setIsMember(!!row);
        setIsOwner(row?.role === "owner");
        setLoading(false);
      });
  }, [user, groupId]);

  return { isMember, isOwner, loading };
}
