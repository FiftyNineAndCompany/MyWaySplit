import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '@/lib/authContext';
import { ToastProvider } from '@/components/layout/Toast';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FloatingBackground from '@/components/layout/FloatingBackground';

export const metadata = {
  title: 'MyWaySplit SaaS — Multi-Tenant Expense Splitter & UPI Settlements',
  description:
    'Multi-tenant expense sharing SaaS with custom member inclusions/exclusions, 30-day retention, direct mobile UPI payments, and micro-financing.',
  keywords: 'expense splitter, SaaS, multi-tenant, UPI payment, selective split, 30-day retention, Saitechverse',
  authors: [{ name: 'Saitechverse Solutions' }],
  openGraph: {
    title: 'MyWaySplit SaaS — Multi-Tenant Expense Splitter',
    description: 'Split expenses selectively, settle via UPI, collaborate in multi-tenant groups.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="w-full max-w-full overflow-x-hidden">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-screen flex flex-col relative w-full max-w-full overflow-x-hidden">
        <FloatingBackground />
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 flex-1 w-full z-10 relative">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
