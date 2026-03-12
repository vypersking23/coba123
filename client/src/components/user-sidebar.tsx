"use client"

import { Link, useLocation } from "wouter";
import { Key, Package, ShoppingCart, User, LogOut } from "lucide-react";
import { HeaderLogo } from "@/components/header-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useUserAuth } from "@/lib/user-auth";

const menuItems = [
  { title: "Dashboard", url: "/user/dashboard", icon: Key },
  { title: "Packages", url: "/user/packages", icon: Package },
  { title: "Order History", url: "/user/orders", icon: ShoppingCart },
  { title: "Account", url: "/user/account", icon: User },
];

export function UserSidebar() {
  const [location] = useLocation();
  const { logout, user } = useUserAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <HeaderLogo size="lg" />
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-wide">KingVypers</span>
            <span className="text-xs text-muted-foreground">User Panel</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive} className={isActive ? "bg-sidebar-accent" : ""}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <span className="text-sm font-medium">{user?.username?.[0]?.toUpperCase() || "U"}</span>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user?.username || "User"}</span>
              <span className="truncate text-xs text-muted-foreground">{user?.email || ""}</span>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
