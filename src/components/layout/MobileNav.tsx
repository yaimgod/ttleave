"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  List,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: List },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/groups", label: "Groups", icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon
              className={cn("h-5 w-5", active && "fill-primary/20")}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
