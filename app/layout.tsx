import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Digital Twin',
  description: 'Chat with the AI Digital Twin',
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
