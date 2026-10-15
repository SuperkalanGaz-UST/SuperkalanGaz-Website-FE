import { notFound, redirect } from 'next/navigation';
import { isStaffRole, resolveStaffRoute, staffDashboardPath, staffRouteParams } from '../../../lib/staffRoutes';

// Staff destinations are finite. Reject unknown paths before streaming a shell.
export const dynamicParams = false;
export const generateStaticParams = staffRouteParams;

export default async function StaffPage({
  params,
}: {
  params: Promise<{ role: string; screen?: string[] }>;
}) {
  const { role, screen } = await params;
  if (!isStaffRole(role)) notFound();
  if (!screen) redirect(staffDashboardPath(role));
  if (screen.length !== 1 || !resolveStaffRoute(`/${role}/${screen[0]}`)) notFound();
  return null;
}
