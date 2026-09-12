import { createFileRoute } from "@tanstack/react-router";
import { PartyScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/buyers")({ head:()=>({meta:[{title:"Buyer Management — GarmentTrade ERP"},{name:"description",content:"Buyer accounts, credit terms, sales history and statements."},{property:"og:title",content:"Buyer Management — GarmentTrade ERP"},{property:"og:description",content:"Buyer accounts, credit terms, sales history and statements."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <PartyScreen kind="buyer"/>; }
