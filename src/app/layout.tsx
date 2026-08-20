import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lorcana Coach",
  description: "AI competitive practice coach for your Disney Lorcana team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
