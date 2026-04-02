"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  initialFavorited: boolean;
}

export function FavoriteButton({ eventId, initialFavorited }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    const next = !favorited;
    setFavorited(next);

    const res = await fetch(`/api/events/${eventId}/favorite`, {
      method: next ? "POST" : "DELETE",
    });

    if (!res.ok) {
      setFavorited(!next);
      toast.error("Failed to update favourite");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={favorited ? "Remove from favourites" : "Add to favourites"}
      className={cn(
        "rounded-full p-1 transition-colors",
        favorited
          ? "text-amber-400 hover:text-amber-500"
          : "text-muted-foreground/40 hover:text-amber-400"
      )}
    >
      <Star
        className="h-4 w-4"
        fill={favorited ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}
