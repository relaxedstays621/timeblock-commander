import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
