import type { Metadata } from "next";

import { MarketCalendar } from "@/components/calendar/MarketCalendar";

export const metadata: Metadata = { title: "Calendar · Trading Station" };

export default function CalendarPage() {
  return <MarketCalendar />;
}
