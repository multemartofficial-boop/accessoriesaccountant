import { createFileRoute } from "@tanstack/react-router";
import { InventoryScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/inventory")({ head:()=>({meta:[{title:"Inventory Control — Rahman's Label ERP"},{name:"description",content:"Warehouse stock, movement history, adjustments and alerts."},{property:"og:title",content:"Inventory Control — Rahman's Label ERP"},{property:"og:description",content:"Warehouse stock, movement history, adjustments and alerts."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <InventoryScreen/>; }
