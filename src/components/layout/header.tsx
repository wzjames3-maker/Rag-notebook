"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
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
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { toast } from "sonner";
import { LogOutIcon, UserIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { ProfileSheet } from "./profile-sheet";

export function Header() {
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const username = session?.user?.name ?? "用户";
  const email = session?.user?.email ?? "";
  const sessionAvatar = session?.user?.image;
  const initial = username.charAt(0).toUpperCase();

  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("stale") === "1") {
      toast.warning("Session 已过期，请重新登录", { duration: 4000 });
    }
  }, [searchParams]);

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
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
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

      <ProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        session={session?.user ?? { name: undefined, email: undefined, image: undefined }}
        updateSession={updateSession}
      />
    </header>
  );
}
