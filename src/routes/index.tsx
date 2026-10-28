import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@/components/erp/screens";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rahman's Label" },
      {
        name: "description",
        content: "Sales, purchase, cash and inventory dashboard for Rahman's Label ERP.",
      },
      { property: "og:title", content: "Rahman's Label" },
      {
        property: "og:description",
        content: "Sales, purchase, cash and inventory dashboard for Rahman's Label ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardScreen,
});
