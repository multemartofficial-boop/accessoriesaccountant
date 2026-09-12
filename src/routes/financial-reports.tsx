import { createFileRoute } from "@tanstack/react-router";
import { FinancialReportsScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/financial-reports")({ head:()=>({meta:[{title:"Financial Reports — GarmentTrade ERP"},{name:"description",content:"Profit and loss, balance sheet, trial balance, ledger and aging."},{property:"og:title",content:"Financial Reports — GarmentTrade ERP"},{property:"og:description",content:"Profit and loss, balance sheet, trial balance, ledger and aging."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <FinancialReportsScreen/>; }
