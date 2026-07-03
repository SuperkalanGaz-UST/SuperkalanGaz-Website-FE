import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import SidebarLayout from '@/components/SidebarLayout';
import '@/styles/global.css';

export const metadata: Metadata = {
    title: {
        default: 'Superkalan Gaz',
        template: '%s | Superkalan Gaz',
    },
    description: 'Superkalan Gaz Operations Hub — Branch Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body suppressHydrationWarning>
                <SidebarLayout>
                    {children}
                </SidebarLayout>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}
