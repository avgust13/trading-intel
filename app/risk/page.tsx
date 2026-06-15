import type { Metadata } from "next";

import { RiskCalculator } from "@/components/RiskCalculator";

export const metadata: Metadata = { title: "Risk · Trading Station" };

export default function RiskPage() {
  return <RiskCalculator />;
}
