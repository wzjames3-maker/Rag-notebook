"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOutIcon, UserIcon, Loader2Icon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
}

export function Header() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = session?.user?.name ?? "用户";
  const email = session?.user?.email ?? "";
  const sessionAvatar = session?.user?.image;
  const initial = username.charAt(0).toUpperCase();

  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    avatar: "",
    bio: "",
  });

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      if (res.status === 401) {
        const json = await res.json().catch(() => ({}));
        if (json.reason === "STALE_SESSION") {
          toast.error("Session 已失效，正在退出登录...");
          await signOut({ callbackUrl: "/login?stale=1" });
          return;
        }
        throw new Error("未登录");
      }
      if (!res.ok) throw new Error("Failed to load profile");
      const json = await res.json();
      const data = json.data as UserProfile;
      setProfile(data);
      setForm({
        username: data.username,
        avatar: data.avatar ?? "",
        bio: data.bio ?? "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载个人资料失败";
      toast.error(message);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (open && !profile) {
      loadProfile();
    }
  }, [open, profile, loadProfile]);

  useEffect(() => {
    if (searchParams.get("stale") === "1") {
      toast.warning("Session 已过期，请重新登录", { duration: 4000 });
    }
  }, [searchParams]);

  const handleSave = useCallback(async () => {
    if (!form.username.trim()) {
      toast.error("用户名不能为空");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        bio: form.bio.trim() || null,
      };
      const trimmedAvatar = form.avatar.trim();
      payload.avatar = trimmedAvatar === "" ? null : trimmedAvatar;

      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "保存失败");
      }

      const json = await res.json();
      setProfile(json.data);
      await updateSession?.({
        name: json.data.username,
        image: json.data.avatar ?? null,
      });
      toast.success("个人资料已更新");
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [form, router, updateSession]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setProfile(null);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur px-4">
      <SidebarTrigger className="hidden lg:flex" />

      <div className="flex-1" />

      <div className="lg:hidden">
        <ThemeToggle />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center rounded-full p-1 hover:bg-accent transition-colors cursor-pointer outline-none">
          <Avatar className="h-8 w-8">
            <AvatarImage src={sessionAvatar ?? ""} alt={username} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <p className="font-medium">{username}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <UserIcon className="mr-2 h-4 w-4" />
            个人资料
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-destructive"
          >
            <LogOutIcon className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>个人资料</SheetTitle>
            <SheetDescription>更新你的头像、用户名和简介</SheetDescription>
          </SheetHeader>

          {loadingProfile || !profile ? (
            <div className="flex-1 space-y-4 px-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14" size="lg">
                  <AvatarImage
                    src={form.avatar.trim() || undefined}
                    alt={form.username}
                  />
                  <AvatarFallback>
                    {form.username.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{form.username || "用户"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-username">用户名</Label>
                <Input
                  id="profile-username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                  maxLength={20}
                  placeholder="3-20 字符"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-avatar">头像 URL</Label>
                <Input
                  id="profile-avatar"
                  value={form.avatar}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, avatar: e.target.value }))
                  }
                  placeholder="https://example.com/avatar.png"
                  type="url"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-bio">简介</Label>
                <Textarea
                  id="profile-bio"
                  value={form.bio}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  maxLength={500}
                  placeholder="介绍一下你自己（最多 500 字符）"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {form.bio.length} / 500
                </p>
              </div>
            </div>
          )}

          <SheetFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || loadingProfile || !profile}
            >
              {saving && <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </header>
  );
}
