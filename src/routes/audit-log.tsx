import { createFileRoute } from "@tanstack/react-router";
import { AuditScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/audit-log")({ head:()=>({meta:[{title:"Audit Log — Rahman's Label ERP"},{name:"description",content:"Review user and system activity across the ERP."},{property:"og:title",content:"Audit Log — Rahman's Label ERP"},{property:"og:description",content:"Review user and system activity across the ERP."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <AuditScreen/>; }
