import type { Metadata } from "next";

import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = { title: "Overview · Trading Station" };

export default function Home() {
  return <Dashboard />;
}
