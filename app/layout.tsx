import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || 'https://empresa-online-ochre.vercel.app'),
  title: { default: 'CATch — boas ofertas, grandes achados', template: '%s | CATch' },
  description: 'Encontre ofertas selecionadas na Amazon Brasil, Amazon EUA e Mercado Livre. Compare preços, filtre por loja e salve seus próximos achados no CATch.',
  applicationName: 'CATch',
  icons: { icon: '/favicon.svg' },
  openGraph: { title: 'CATch — seu próximo achado começa aqui', description: 'Faro para ofertas. Explore automotivo, performance e longevidade.', locale: 'pt_BR', type: 'website', images: [{ url: '/brand/catch-hero.webp', width: 1280, height: 698, alt: 'Mascote CATch' }] },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
