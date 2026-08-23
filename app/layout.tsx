import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wild Card | Sleeper Modifier League",
  description: "Weekly fantasy football modifiers for your Sleeper league.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
