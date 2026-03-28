import type { Metadata } from "next";
import { Figtree, Fjalla_One } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/Providers";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const fjalla = Fjalla_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fjalla",
});

export const metadata: Metadata = {
  title: "MonadWork",
  description: "Hire anyone, verify credentials on-chain, and pay by the second.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${fjalla.variable} bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
