import { useState, type FormEvent } from "react";
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
  Menu,
  MoreHorizontal,
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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

const primaryMobileItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Sales", to: "/sales", icon: Store },
  { label: "Purchase", to: "/purchase", icon: ShoppingCart },
  { label: "Inventory", to: "/inventory", icon: Boxes },
];

const moreMobileItems = groups.flatMap((group) => group.items).filter((item) => !primaryMobileItems.some((primary) => primary.to === item.to));

function Brand() {
  const { state } = useSidebar();
  return (
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">GT</div>
      {state === "expanded" && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-bold text-sidebar-foreground">GarmentTrade</div>
          <div className="truncate text-[11px] uppercase text-sidebar-foreground/55">Accessories ERP</div>
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
      <SidebarContent className="gap-2 py-3">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="h-7 px-3 text-[10px] font-bold uppercase tracking-[0.12em]">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="relative h-9 rounded-md border-l-2 border-l-transparent px-2.5 text-[13px] transition-colors hover:bg-sidebar-accent data-[active=true]:border-l-sidebar-primary data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary [&>a>svg]:size-[18px] [&>a>svg]:data-[active=true]:text-sidebar-primary">
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
            <SidebarMenuButton size="lg" tooltip="Nadia Rahman" className="rounded-md">
              <div className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-semibold text-accent-foreground">NR</div>
              <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-xs font-semibold">Nadia Rahman</div><div className="truncate text-[11px] text-sidebar-foreground/55">Accounts Manager</div></div>
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
  const [search, setSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => to === "/" ? pathname === "/" : pathname.startsWith(to);
  const moreActive = moreMobileItems.some((item) => isActive(item.to));
  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("erp-global-search", { detail: search }));
    setMobileSearchOpen(false);
  };
  return (
    <SidebarProvider style={{ "--sidebar-width": "14rem", "--sidebar-width-icon": "3.25rem" } as React.CSSProperties} className="w-full">
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-workspace">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-3 shadow-header backdrop-blur md:h-15 md:px-4">
          <SidebarTrigger className="hidden shrink-0 md:inline-flex" />
          <button type="button" onClick={() => setMoreOpen(true)} aria-label="Open all modules" className="grid size-11 shrink-0 place-items-center rounded-md text-primary md:hidden"><Menu className="size-5" /></button>
          <div className="flex min-w-0 items-center gap-2 md:hidden"><div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">GT</div><span className="truncate text-sm font-bold">GarmentTrade</span></div>
          <form onSubmit={runSearch} className="relative hidden w-full max-w-md md:block">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Global search" placeholder="Search this page..." className="h-9 rounded-lg border-border bg-surface-subtle pl-9 text-xs shadow-none focus:bg-card" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground lg:block">FY 2026 · Dhaka Office</span>
            <Button variant="ghost" size="icon" aria-label="Search" className="size-11 rounded-md md:hidden" onClick={() => setMobileSearchOpen((open) => !open)}><Search className="size-5" /></Button>
            <Button variant="outline" size="icon" aria-label="Notifications" className="relative size-11 rounded-lg bg-card shadow-sm md:size-9"><Bell className="size-4 md:size-3.5" /><span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-destructive md:right-1.5 md:top-1.5" /></Button>
          </div>
          {mobileSearchOpen && <form onSubmit={runSearch} className="absolute inset-0 z-10 flex items-center gap-2 bg-background px-3 md:hidden"><Search className="size-4 shrink-0 text-muted-foreground"/><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Global search" placeholder="Search this page..." className="h-11 flex-1 rounded-lg bg-surface-subtle"/><Button type="button" variant="ghost" className="h-11 px-3" onClick={() => setMobileSearchOpen(false)}>Cancel</Button></form>}
        </header>
        <main className="min-w-0 flex-1 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:p-5 lg:p-6">{children}</main>
        <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/98 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_oklch(0.22_0.03_255/0.08)] backdrop-blur md:hidden">
          {primaryMobileItems.map((item) => <Link key={item.to} to={item.to} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isActive(item.to) ? "text-primary" : "text-muted-foreground"}`}><item.icon className="size-5"/><span>{item.label}</span></Link>)}
          <button type="button" onClick={() => setMoreOpen(true)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${moreActive ? "text-primary" : "text-muted-foreground"}`}><MoreHorizontal className="size-5"/><span>More</span></button>
        </nav>
        <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[82svh] rounded-t-xl md:hidden">
            <DrawerHeader className="border-b px-5 pb-4 pt-3 text-left"><DrawerTitle className="text-base">All modules</DrawerTitle><DrawerDescription className="text-xs">Open any area of GarmentTrade ERP.</DrawerDescription></DrawerHeader>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {moreMobileItems.map((item) => <DrawerClose asChild key={item.to}><Link to={item.to} className={`grid min-h-16 grid-cols-[44px_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 text-xs font-semibold ${isActive(item.to) ? "border-primary bg-accent text-primary" : "bg-card text-foreground"}`}><span className="grid size-10 place-items-center rounded-md bg-surface-subtle"><item.icon className="size-4"/></span><span className="min-w-0 leading-tight">{item.label}</span></Link></DrawerClose>)}
            </div>
          </DrawerContent>
        </Drawer>
      </SidebarInset>
    </SidebarProvider>
  );
}
