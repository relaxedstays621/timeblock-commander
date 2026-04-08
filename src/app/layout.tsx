import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/SessionProvider';

export const metadata: Metadata = {
  title: 'TimeBlock Commander',
  description: 'AI-managed time-blocking command center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
