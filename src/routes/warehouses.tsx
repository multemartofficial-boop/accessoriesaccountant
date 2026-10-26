import { createFileRoute } from "@tanstack/react-router";
import { WarehousesScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/warehouses")({ head:()=>({meta:[{title:"Multi-Warehouse — Rahman's Label ERP"},{name:"description",content:"Warehouse-level stock and internal transfers."},{property:"og:title",content:"Multi-Warehouse — Rahman's Label ERP"},{property:"og:description",content:"Warehouse-level stock and internal transfers."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <WarehousesScreen/>; }
