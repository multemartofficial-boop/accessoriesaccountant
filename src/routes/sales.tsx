import { createFileRoute } from "@tanstack/react-router";
import { SalesScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/sales")({ head:()=>({meta:[{title:"Sales Management — GarmentTrade ERP"},{name:"description",content:"Sales orders, delivery chalan, invoices, returns and collections."},{property:"og:title",content:"Sales Management — GarmentTrade ERP"},{property:"og:description",content:"Sales orders, delivery chalan, invoices, returns and collections."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <SalesScreen/>; }
