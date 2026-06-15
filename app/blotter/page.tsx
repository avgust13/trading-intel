import type { Metadata } from "next";

import { Blotter } from "@/components/blotter/Blotter";

export const metadata: Metadata = { title: "Blotter · Trading Station" };

export default function BlotterPage() {
  return <Blotter />;
}
