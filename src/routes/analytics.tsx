import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/analytics")({ head:()=>({meta:[{title:"Reports & Analytics — GarmentTrade ERP"},{name:"description",content:"Generate operational reports and exports."},{property:"og:title",content:"Reports & Analytics — GarmentTrade ERP"},{property:"og:description",content:"Generate operational reports and exports."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <AnalyticsScreen/>; }
