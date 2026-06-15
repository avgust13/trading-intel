// Dark palette + fonts, lifted from the original index.html :root variables.

export interface AppTheme {
  colors: {
    bg: string;
    zebra: string;
    fg: string;
    muted: string;
    accent: string;
    price: string;
    green: string;
    red: string;
    border: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  /** Semantic colors for calendar event categories (impact + type). */
  event: {
    high: string;
    medium: string;
    low: string;
    earnings: string;
    centralBank: string;
    crypto: string;
  };
  /** Shared page-width tokens so every tab uses horizontal space consistently. */
  layout: {
    /** Max content width for standard (stacked) tabs. */
    content: string;
    /** Max width for the wide two-pane Risk Calculator. */
    wide: string;
    /** Fluid horizontal page padding. */
    gutter: string;
  };
}

export const theme: AppTheme = {
  colors: {
    bg: "#0b0f17",
    zebra: "#0d1320",
    fg: "#e5e7eb",
    muted: "#9ca3af",
    accent: "#60a5fa",
    price: "#93c5fd",
    green: "#22c55e",
    red: "#ef4444",
    border: "#1f2937",
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
  event: {
    high: "#ef4444", // red — high impact
    medium: "#f59e0b", // orange — medium impact
    low: "#9ca3af", // gray — low impact
    earnings: "#60a5fa", // blue — earnings
    centralBank: "#a78bfa", // purple — Fed / central banks
    crypto: "#22c55e", // green — crypto
  },
  layout: {
    content: "1280px",
    wide: "1500px",
    gutter: "clamp(16px, 4vw, 40px)",
  },
};
