import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NovaLuxe | Premium Task Management",
  description: "Premium task-assignment platform for business owners, team leads, and educators. Connect admins with members to assign tasks with priority levels.",
  keywords: ["NovaLuxe", "Task Management", "Team Collaboration", "Business", "Productivity"],
  authors: [{ name: "NovaLuxe Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "NovaLuxe | Premium Task Management",
    description: "Premium task-assignment platform with neon-lit luxury interface",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NovaLuxe",
    description: "Premium task-assignment platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
