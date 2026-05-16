import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seller Lab",
  description: "Tools for Spoonflower sellers — by ZabZabLab",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
