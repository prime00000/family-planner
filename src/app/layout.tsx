import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ToastProvider } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toast'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Family Planner",
  description: "A family planning and task management application",
  applicationName: "Family Planner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Family Planner",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon-192x192.png",
    icon: "/icons/icon-192x192.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  themeColor: "#3B82F6",
  keywords: ["family planner", "task management", "family organization"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <ToastProvider>
          <AuthProvider>
            <AuthGuard>
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
            </AuthGuard>
          </AuthProvider>
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
