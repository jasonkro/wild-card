import type { Metadata } from "next";
import "./globals.css";
import "./league-contrast.css";

export const metadata: Metadata = {
  title: "League of Chaos | Sleeper Modifier League",
  description: "Weekly fantasy football modifiers and score audits for your Sleeper league.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
