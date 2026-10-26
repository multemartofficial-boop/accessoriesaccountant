import { createFileRoute } from "@tanstack/react-router";
import { PurchaseScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/purchase")({ head:()=>({meta:[{title:"Purchase Management — Rahman's Label ERP"},{name:"description",content:"Purchase orders, supplier invoices, payments and pending commitments."},{property:"og:title",content:"Purchase Management — Rahman's Label ERP"},{property:"og:description",content:"Purchase orders, supplier invoices, payments and pending commitments."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <PurchaseScreen/>; }
