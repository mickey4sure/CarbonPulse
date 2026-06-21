import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CarboNudge — Track less. Live greener.",
  description:
    "CarboNudge helps you understand, track, and reduce your carbon footprint through simple daily actions and personalized AI insights.",
  keywords: ["carbon footprint", "climate", "sustainability", "CO2 tracker", "green living"],
  openGraph: {
    title: "CarboNudge",
    description: "Track less. Live greener.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Material Symbols for icons */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${hankenGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased bg-background-subtle text-on-background`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
