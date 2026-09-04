import { supabase } from './ingestion.mjs';
import { dispatchOffers } from './whatsapp.mjs';

export async function loadPendingDistributionJobs() {
  const [offers, channels, dispatched] = await Promise.all([
    supabase('produtos?select=id,slug,plataforma,titulo,categoria,subcategoria,regiao,moeda,preco_atual,preco_medio_30d,desconto_real_percentual,oferta_valida_ate,cupons(codigo,valido_ate,ativo)&ativo=eq.true&url_afiliado=not.is.null'),
    supabase('canais_whatsapp?select=id,group_id,categoria,subcategoria,regiao,provedor,visibilidade&ativo=eq.true'),
    supabase('disparos_whatsapp?select=produto_id,canal_id&status=eq.ENVIADO'),
  ]);
  const alreadySent = new Set(dispatched.map((row) => `${row.produto_id}:${row.canal_id}`));
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  return offers.flatMap((offer) => channels
    .filter((channel) => channel.regiao === offer.regiao && channel.categoria === offer.categoria && (!channel.subcategoria || channel.subcategoria === offer.subcategoria))
    .filter((channel) => !alreadySent.has(`${offer.id}:${channel.id}`))
    .map((channel) => ({
      productId: offer.id,
      channelId: channel.id,
      groupId: channel.group_id,
      visibility: channel.visibilidade,
      provider: channel.provedor,
      offer: {
        ...offer,
        cupom: offer.cupons?.find((coupon) => coupon.ativo && (!coupon.valido_ate || new Date(coupon.valido_ate) > new Date()))?.codigo,
        short_url: `${siteUrl}/api/click/${offer.slug}`,
      },
    })));
}

export async function runDistribution() {
  const jobs = await loadPendingDistributionJobs();
  const results = await dispatchOffers(jobs);
  if (results.length === 0) return [];

  await supabase('disparos_whatsapp?on_conflict=produto_id,canal_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(results.map((result) => ({
      produto_id: result.job.productId,
      canal_id: result.job.channelId,
      status: result.status === 'sent' ? 'ENVIADO' : result.status === 'ignored' ? 'IGNORADO' : 'FALHOU',
      provider_message_id: result.response?.messages?.[0]?.id || result.response?.key?.id || null,
      erro: result.error || result.reason || null,
      enviado_em: result.status === 'sent' ? new Date().toISOString() : null,
    }))),
  });
  return results;
}
