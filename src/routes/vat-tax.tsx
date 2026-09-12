import { createFileRoute } from "@tanstack/react-router";
import { VatTaxScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/vat-tax")({ head:()=>({meta:[{title:"VAT & Tax — GarmentTrade ERP"},{name:"description",content:"Configure tax rates and review VAT reports."},{property:"og:title",content:"VAT & Tax — GarmentTrade ERP"},{property:"og:description",content:"Configure tax rates and review VAT reports."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <VatTaxScreen/>; }
