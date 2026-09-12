import { createFileRoute } from "@tanstack/react-router";
import { ProductsScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/products")({ head:()=>({meta:[{title:"Product Master — GarmentTrade ERP"},{name:"description",content:"Garments accessories SKU, pricing and stocking master."},{property:"og:title",content:"Product Master — GarmentTrade ERP"},{property:"og:description",content:"Garments accessories SKU, pricing and stocking master."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}), component: Page });
function Page() { return <ProductsScreen/>; }
