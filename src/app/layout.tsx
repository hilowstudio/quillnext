import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { GlobalShell } from "@/components/layout/GlobalShell";
import { StudentProfileProvider } from "@/components/providers/StudentProfileProvider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuillNext",
  description: "Curriculum generation platform",
};

import { auth } from "@/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} ${cormorantGaramond.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NuqsAdapter>
          <StudentProfileProvider>
            <GlobalShell user={session?.user}>
              {children}
            </GlobalShell>
            <Toaster position="bottom-right" richColors closeButton />
          </StudentProfileProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}

