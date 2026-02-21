
import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
    title: "FWA Sentinel",
    description: "AI-Powered Fraud Detection",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased flex bg-white h-screen overflow-hidden text-slate-900">
                <Sidebar />
                <main className="flex-1 flex flex-col h-full bg-slate-50/50">
                    {children}
                </main>
            </body>
        </html>
    );
}
