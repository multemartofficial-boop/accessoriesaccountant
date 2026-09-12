import { createFileRoute } from "@tanstack/react-router";
import { DocumentsScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/documents")({ head:()=>({meta:[{title:"Document Generator — GarmentTrade ERP"},{name:"description",content:"Create and preview invoices and delivery chalans."},{property:"og:title",content:"Document Generator — GarmentTrade ERP"},{property:"og:description",content:"Create and preview invoices and delivery chalans."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <DocumentsScreen/>; }
