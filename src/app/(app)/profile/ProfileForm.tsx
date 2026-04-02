"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Upload, BookOpen } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

interface Props {
  profile: {
    id: string;
    full_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    email_notifications: boolean;
  };
  userEmail: string;
}

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100),
  nickname: z.string().max(50).optional().nullable(),
  email_notifications: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export function ProfileForm({ profile, userEmail }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      nickname: profile.nickname ?? "",
      email_notifications: profile.email_notifications,
    },
  });

  const emailNotifications = watch("email_notifications");
  const fullName = watch("full_name");

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to upload avatar");
        return;
      }

      setAvatarUrl(json.avatar_url);
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: ProfileFormValues) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const json = await res.json();
    if (!res.ok) {
      toast.error(
        typeof json.error === "string" ? json.error : "Failed to save profile"
      );
      return;
    }

    toast.success("Profile saved");
  }

  async function handlePasswordReset() {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your inbox");
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile picture</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xl">
              {getInitials(fullName || profile.full_name, userEmail)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload photo
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Max 2 MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile details form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                placeholder="Your full name"
                {...register("full_name")}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nickname">
                Nickname{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="nickname"
                placeholder="How others call you"
                {...register("nickname")}
              />
              {errors.nickname && (
                <p className="text-xs text-destructive">{errors.nickname.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={userEmail}
                readOnly
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_notifications" className="text-sm font-medium">
                  Email notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive email updates about your events and groups.
                </p>
              </div>
              <Switch
                id="email_notifications"
                checked={emailNotifications}
                onCheckedChange={(checked) =>
                  setValue("email_notifications", checked, { shouldDirty: true })
                }
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            We will send a password reset link to your email address.
          </p>
          <Button type="button" variant="outline" onClick={handlePasswordReset}>
            Send password reset email
          </Button>
        </CardContent>
      </Card>

      {/* Help section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Help</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Revisit the onboarding tutorial to learn about TTLeave features.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowTutorial(true)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            View tutorial
          </Button>
        </CardContent>
      </Card>

      <OnboardingModal
        open={showTutorial}
        onComplete={() => setShowTutorial(false)}
      />
    </div>
  );
}
