import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { GlobalShell } from "@/components/layout/GlobalShell";
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
  title: "Quill & Compass",
  description:
    "Calm, grounded homeschooling: AI curriculum, a living library, and family discipleship in one place.",
  icons: {
    icon: [
      { url: "/assets/branding/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/branding/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/branding/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/assets/branding/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/assets/branding/icons/favicon-32.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Quill & Compass",
    statusBarStyle: "default",
  },
};

import { auth } from "@/auth";
import { getActiveProfile } from "@/server/profiles/active-profile";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const activeProfile = await getActiveProfile();

  return (
    <html lang="en" className={`${inter.variable} ${cormorantGaramond.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NuqsAdapter>
          <GlobalShell user={session?.user} activeProfile={activeProfile}>
            {children}
          </GlobalShell>
          <Toaster position="bottom-right" richColors closeButton />
        </NuqsAdapter>
      </body>
    </html>
  );
}

