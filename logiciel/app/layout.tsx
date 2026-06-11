import type { Metadata } from "next";
import { Archivo_Black, Open_Sans } from "next/font/google";
import { AuthProvider } from "@/app/context/AuthContext";
import { Providers } from "@/app/providers";
import AccessibilityToolbar from "@/app/components/AccessibilityToolbar";
import "./globals.css";

const archivoBlack = Archivo_Black({
  weight: "400",
  variable: "--font-archivo",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-opensans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Optigistik",
  description: "Portail Transporteur B2B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${archivoBlack.variable} ${openSans.variable} font-sans antialiased`}
      >
        <Providers>
          <AuthProvider>
            {children}
            <AccessibilityToolbar />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
