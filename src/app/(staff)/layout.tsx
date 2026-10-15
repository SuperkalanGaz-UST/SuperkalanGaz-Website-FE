import type { ReactNode } from 'react';
import App from '../App';

export default function StaffLayout({ children }: { children: ReactNode }) {
  // Keep session, sidebar and selected-branch state mounted across staff URLs.
  // Invitation registration has its own route outside this layout.
  return <App>{children}</App>;
}
