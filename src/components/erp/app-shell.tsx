import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
      <SidebarContent className="gap-2 py-3">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="h-7 px-3 text-[9px] font-bold uppercase tracking-[0.12em]">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="relative h-9 rounded-md border-l-2 border-l-transparent px-2.5 text-[12px] transition-colors hover:bg-sidebar-accent data-[active=true]:border-l-sidebar-primary data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary [&>a>svg]:data-[active=true]:text-sidebar-primary">
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
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("erp-global-search", { detail: search }));
    if (useRouterState) void navigate;
  };
  return (
    <SidebarProvider style={{ "--sidebar-width": "14rem", "--sidebar-width-icon": "3.25rem" } as React.CSSProperties} className="w-full">
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-workspace">
        <header className="sticky top-0 z-20 flex h-15 items-center gap-3 border-b bg-background/95 px-4 shadow-header backdrop-blur">
          <SidebarTrigger className="shrink-0" />
          <form onSubmit={runSearch} className="relative hidden w-full max-w-md md:block">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Global search" placeholder="Search this page..." className="h-9 rounded-lg border-border bg-surface-subtle pl-9 text-xs shadow-none focus:bg-card" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground lg:block">FY 2026 · Dhaka Office</span>
             <Button variant="outline" size="icon" aria-label="Notifications" className="relative h-9 w-9 rounded-lg bg-card shadow-sm"><Bell className="size-3.5" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" /></Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
