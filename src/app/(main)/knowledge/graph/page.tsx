import { redirect } from "next/navigation";

export default function GraphPage() {
  redirect("/knowledge?tab=graph");
}
