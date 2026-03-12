import { Link, useLocation } from "wouter";
import { Key, LayoutDashboard, Plus, DollarSign, Settings, LogOut, ExternalLink, LayoutGrid, Package, Users, ShoppingCart, Star, Gamepad2, User } from "lucide-react";
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
import { useAuth } from "@/lib/auth";

const menuItems = [
  { title: "Dashboard", url: "/kings/dashboard", icon: LayoutDashboard },
  { title: "Order Logs", url: "/kings/orders", icon: ShoppingCart },
  { title: "Keys", url: "/kings/keys", icon: Key },
  { title: "Generate Keys", url: "/kings/generate", icon: Plus },
  { title: "Revenue", url: "/kings/revenue", icon: DollarSign },
  { title: "Showcase", url: "/kings/showcase", icon: LayoutGrid },
  { title: "Packages", url: "/kings/packages", icon: Package },
  { title: "Teams", url: "/kings/teams", icon: Users },
  { title: "Testimonials", url: "/kings/testimonials", icon: Star },
  { title: "Game Support", url: "/kings/game-support", icon: Gamepad2 },
  { title: "Users", url: "/kings/users", icon: User },
  { title: "Settings", url: "/kings/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, username } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <HeaderLogo size="lg" />
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-wide">KingVypers</span>
            <span className="text-xs text-muted-foreground">Key Management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url ||
                  (item.url !== "/kings/dashboard" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent" : ""}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(" ", "-")}`}>
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
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
              <ExternalLink className="h-4 w-4" />
              <span>View site</span>
            </Button>
          </Link>
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <span className="text-sm font-medium">{username?.[0]?.toUpperCase() || "A"}</span>
            </div>
            <span className="text-sm font-medium">{username || "Admin"}</span>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
