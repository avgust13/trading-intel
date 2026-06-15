import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Providers } from "./providers";
import { StyledComponentsRegistry } from "./registry";

export const metadata: Metadata = {
  title: "Trading Station",
  description: "A live market dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* Inline dark background paints immediately, before styles hydrate. */}
      <body style={{ margin: 0, background: "#0b0f17" }}>
        <StyledComponentsRegistry>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
