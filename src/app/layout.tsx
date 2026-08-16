import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/index.css';

export const metadata: Metadata = {
  title: 'Superkalan Gaz CRM',
  description:
    'Centralized CRM for Superkalan Gaz — internal staff dashboard (FA/BO/BM)',
  icons: {
    icon: [{ url: '/logo%20only.png', type: 'image/png' }],
  },
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
