import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Peer Support Studio",
    description: "HIPAA-compliant peer support documentation platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.className} antialiased bg-[#F8FAFB] min-h-screen`}>
                <SessionProvider>
                    <Header />
                    <main className="flex-1">{children}</main>
                    <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
                        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-500">
                            <div className="flex items-center justify-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    HIPAA Compliant
                                </span>
                                <span>•</span>
                                <span>Peer Support Studio</span>
                            </div>
                        </div>
                    </footer>
                </SessionProvider>
            </body>
        </html>
    );
}
