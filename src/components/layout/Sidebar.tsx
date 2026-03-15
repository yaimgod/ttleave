"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  List,
  Users,
  Shield,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: List },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/groups", label: "Groups", icon: Users },
];

const adminItems = [
  { href: "/admin", label: "Admin", icon: Shield },
];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  collapsed: boolean;
  active: boolean;
}

function NavItem({ href, label, icon: Icon, collapsed, active }: NavItemProps) {
  const button = (
    <Button
      variant={active ? "secondary" : "ghost"}
      className={cn(
        "w-full justify-start gap-3",
        collapsed && "justify-center px-2"
      )}
      asChild
    >
      <Link href={href}>
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();
  const { isAdmin } = useIsAdmin();

  const collapsed = !sidebarOpen;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-full flex-col border-r bg-background transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-14 items-center border-b px-3",
            collapsed ? "justify-center" : "gap-2 px-4"
          )}
        >
          <Timer className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">TTLeave</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              collapsed={collapsed}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          ))}

          {isAdmin && (
            <>
              <div
                className={cn(
                  "my-2 border-t",
                  collapsed ? "mx-1" : "mx-2"
                )}
              />
              {adminItems.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  collapsed={collapsed}
                  active={pathname.startsWith(item.href)}
                />
              ))}
            </>
          )}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
