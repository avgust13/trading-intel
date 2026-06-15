import type { Metadata } from "next";

import { Sessions } from "@/components/Sessions";

export const metadata: Metadata = { title: "Sessions · Trading Station" };

export default function SessionsPage() {
  return <Sessions />;
}
