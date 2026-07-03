import type { Metadata } from 'next';
import '../styles/index.css';

export const metadata: Metadata = {
  title: 'Superkalan Gaz CRM',
  description:
    'Centralized CRM for Superkalan Gaz — internal staff dashboard (FA/BO/BM)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
