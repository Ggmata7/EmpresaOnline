const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function formatOfferMessage(offer) {
  const money = new Intl.NumberFormat(offer.moeda === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency: offer.moeda });
  return [
    `🚨 ${offer.titulo} — ${Math.round(offer.desconto_real_percentual)}% OFF`,
    `💰 De ${money.format(offer.preco_medio_30d)} por ${money.format(offer.preco_atual)}`,
    offer.cupom ? `🎟️ Cupom: ${offer.cupom}` : null,
    offer.oferta_valida_ate ? `⏳ Válida até ${new Date(offer.oferta_valida_ate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : '⏳ Oferta sujeita a alteração',
    `🔗 ${offer.short_url}`,
    '',
    'Publicidade · link de afiliado. Confira preço e condições na loja.',
  ].filter(Boolean).join('\n');
}

async function sendMetaCloud(recipientId, message) {
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientId, type: 'text', text: { preview_url: true, body: message } }),
  });
  if (!response.ok) throw new Error(`Meta Cloud API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function sendEvolution(groupId, message) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const response = await fetch(`${base}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { apikey: process.env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: groupId, text: message, delay: 1200, linkPreview: true }),
  });
  if (!response.ok) throw new Error(`Evolution API ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function dispatchOffers(jobs) {
  const results = [];
  for (const job of jobs) {
    try {
      if (job.offer.plataforma === 'MERCADO_LIVRE' && job.visibility !== 'PUBLICO') {
        results.push({ status: 'ignored', job, reason: 'Mercado Livre content is restricted to configured public channels.' });
        continue;
      }
      const message = formatOfferMessage(job.offer);
      const provider = String(job.provider || process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
      const response = provider === 'evolution' ? await sendEvolution(job.groupId, message) : await sendMetaCloud(job.groupId, message);
      results.push({ status: 'sent', job, response });
    } catch (error) {
      results.push({ status: 'failed', job, error: error instanceof Error ? error.message : String(error) });
    }
    await sleep(1800 + Math.random() * 2200);
  }
  return results;
}
