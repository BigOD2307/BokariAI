import LayoutDashboard from '@/components/Admin/LayoutDashboard';

export const metadata = { title: 'Bokari — Admin' };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutDashboard>{children}</LayoutDashboard>;
}
