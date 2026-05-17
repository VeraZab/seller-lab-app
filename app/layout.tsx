import type { Metadata } from "next";
import {
  Newsreader,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import EmotionRegistry from "./emotion-registry";
import "./colors-and-type.css";
import "./components.css";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--next-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--next-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--next-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seller Lab Pro — SEO keyword optimization for Spoonflower sellers",
  description:
    "Find better keywords and rewrite tags for your Spoonflower listings. The paid web companion to the free Seller Lab Chrome extension — by zabzablab.",
  icons: { icon: "/assets/logo-original.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body>
        <EmotionRegistry>{children}</EmotionRegistry>
      </body>
    </html>
  );
}
