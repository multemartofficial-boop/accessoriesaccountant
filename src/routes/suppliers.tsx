import { createFileRoute } from "@tanstack/react-router";
import { PartyScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/suppliers")({ head:()=>({meta:[{title:"Supplier Management — Rahman's Label ERP"},{name:"description",content:"Supplier purchase history, payable balances and payments."},{property:"og:title",content:"Supplier Management — Rahman's Label ERP"},{property:"og:description",content:"Supplier purchase history, payable balances and payments."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <PartyScreen kind="supplier"/>; }
