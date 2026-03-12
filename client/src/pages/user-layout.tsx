"use client"

import { Switch, Route, Redirect } from "wouter";
import type { CSSProperties } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { UserSidebar } from "@/components/user-sidebar";
import { UserKeys } from "./user-keys";
import { UserPackages } from "./user-packages";
import { UserOrders } from "./user-orders";
import { UserAccount } from "./user-account";

export function UserLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as CSSProperties}>
      <div className="flex min-h-screen w-full circuit-overlay">
        <UserSidebar />
        <SidebarInset>
          <header className="glass flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <Switch>
              <Route path="/user" component={() => <Redirect to="/user/dashboard" />} />
              <Route path="/user/dashboard" component={UserKeys} />
              <Route path="/user/packages" component={UserPackages} />
              <Route path="/user/orders" component={UserOrders} />
              <Route path="/user/account" component={UserAccount} />
              <Route component={() => <Redirect to="/user/dashboard" />} />
            </Switch>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
