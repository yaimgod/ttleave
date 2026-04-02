"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#14b8a6", "#f43f5e", "#84cc16", "#0ea5e9",
];

interface Props {
  groupId: string;
  initialColor: string;
}

export function MemberColorPicker({ groupId, initialColor }: Props) {
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);

  const save = async (newColor: string) => {
    setSaving(true);
    setColor(newColor);
    const res = await fetch(`/api/groups/${groupId}/members/color`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: newColor }),
    });
    if (!res.ok) {
      toast.error("Failed to update color");
      setColor(color);
    } else {
      toast.success("Calendar color updated");
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          Your calendar color
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Your events appear in this color on the team calendar.
        </p>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => save(c)}
              disabled={saving}
              className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
              }}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Custom:</Label>
          <input
            type="color"
            value={color}
            onChange={(e) => save(e.target.value)}
            disabled={saving}
            className="h-7 w-10 cursor-pointer rounded border"
          />
          <span className="text-xs text-muted-foreground font-mono">{color}</span>
        </div>
      </CardContent>
    </Card>
  );
}
