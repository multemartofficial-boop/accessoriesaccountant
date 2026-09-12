import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenText,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileOutput,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const groups: { label: string; items: { label: string; to: string; icon: LucideIcon; badge?: string }[] }[] = [
  {
    label: "Main operations",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Buyers", to: "/buyers", icon: Users },
      { label: "Suppliers", to: "/suppliers", icon: Truck },
      { label: "Products", to: "/products", icon: PackageSearch },
      { label: "Purchase", to: "/purchase", icon: ShoppingCart, badge: "7" },
      { label: "Inventory", to: "/inventory", icon: Boxes, badge: "5" },
      { label: "Sales", to: "/sales", icon: Store },
      { label: "Documents", to: "/documents", icon: FileOutput },
      { label: "Warehouses", to: "/warehouses", icon: Warehouse },
    ],
  },
  {
    label: "Accounting & reports",
    items: [
      { label: "Cash & Bank", to: "/cash-bank", icon: CircleDollarSign },
      { label: "Approvals", to: "/approvals", icon: ClipboardCheck, badge: "12" },
      { label: "Audit Log", to: "/audit-log", icon: Activity },
      { label: "VAT & Tax", to: "/vat-tax", icon: ReceiptText },
      { label: "Financial Reports", to: "/financial-reports", icon: BookOpenText },
      { label: "Analytics Center", to: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Settings & others",
    items: [{ label: "Settings", to: "/settings", icon: Settings }],
  },
];

function Brand() {
  const { state } = useSidebar();
  return (
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">GT</div>
      {state === "expanded" && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-bold text-sidebar-foreground">GarmentTrade</div>
          <div className="truncate text-[10px] uppercase text-sidebar-foreground/55">Accessories ERP</div>
        </div>
      )}
    </div>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-0"><Brand /></SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="h-7 px-2 text-[10px] font-semibold uppercase">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-8 rounded-sm text-[12px] data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground">
                        <Link to={item.to}><item.icon /><span>{item.label}</span>{item.badge && <span className="ml-auto text-[10px] tabular-nums opacity-70">{item.badge}</span>}</Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Nadia Rahman" className="rounded-sm">
              <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-accent text-[10px] font-semibold text-accent-foreground">NR</div>
              <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-xs font-semibold">Nadia Rahman</div><div className="truncate text-[10px] text-sidebar-foreground/55">Accounts Manager</div></div>
              <ChevronDown className="size-3" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "14rem", "--sidebar-width-icon": "3.25rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-workspace">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger className="shrink-0" />
          <div className="relative hidden w-full max-w-sm md:block">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Global search" placeholder="Search products, buyers, invoices..." className="h-8 rounded-sm pl-8 text-xs shadow-none" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground lg:block">FY 2026 · Dhaka Office</span>
            <Button variant="outline" size="icon" aria-label="Notifications" className="relative h-8 w-8 rounded-sm shadow-none"><Bell className="size-3.5" /><span className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive" /></Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
