import { createFileRoute } from "@tanstack/react-router";
import { CashBankScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/cash-bank")({ head:()=>({meta:[{title:"Cash & Bank — GarmentTrade ERP"},{name:"description",content:"Cash and bank account balances, transactions and statements."},{property:"og:title",content:"Cash & Bank — GarmentTrade ERP"},{property:"og:description",content:"Cash and bank account balances, transactions and statements."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <CashBankScreen/>; }
