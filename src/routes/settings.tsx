import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/settings")({ head:()=>({meta:[{title:"Settings — GarmentTrade ERP"},{name:"description",content:"Configure company identity, users and system defaults."},{property:"og:title",content:"Settings — GarmentTrade ERP"},{property:"og:description",content:"Configure company identity, users and system defaults."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <SettingsScreen/>; }
