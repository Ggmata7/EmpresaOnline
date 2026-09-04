import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Radar de Ofertas — descontos reais, verificados',
  description: 'Ofertas verificadas por histórico de preço nos nichos automotivo, performance e longevidade.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
