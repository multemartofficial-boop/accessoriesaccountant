import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/approvals")({ head:()=>({meta:[{title:"Approval Workflow — GarmentTrade ERP"},{name:"description",content:"Review and authorize operational transactions."},{property:"og:title",content:"Approval Workflow — GarmentTrade ERP"},{property:"og:description",content:"Review and authorize operational transactions."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <ApprovalsScreen/>; }
