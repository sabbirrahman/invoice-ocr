import type { Metadata } from "next";

import { Geist_Mono, Geist } from "next/font/google";

import { BreadcrumbProvider } from "@/components/custom/breadcrumb";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Invoice Intake",
  description:
    "Extract Japanese invoices, verify amounts, review, then register.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <ThemeProvider defaultTheme="system">
            <BreadcrumbProvider>{children}</BreadcrumbProvider>
          </ThemeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
