import { readFile } from 'node:fs/promises';
import { runIngestion } from './ingestion.mjs';
import { runDistribution } from './distribution.mjs';

async function main() {
  const configPath = process.env.SOURCES_FILE || new URL('../config/sources.json', import.meta.url);
  const raw = process.env.SOURCES_JSON || await readFile(configPath, 'utf8');
  const sources = JSON.parse(raw);
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('No sources configured. Copy sources.example.json to sources.json and add real product URLs.');
  const results = await runIngestion(sources);
  const summary = results.map((result) => result.status === 'fulfilled' ? result.value : { published: false, error: String(result.reason) });
  const distribution = process.env.ENABLE_WHATSAPP_DISPATCH === 'true' ? await runDistribution() : [];
  console.log(JSON.stringify({ ranAt: new Date().toISOString(), ingestion: summary, distribution }, null, 2));
  if (results.some((result) => result.status === 'rejected')) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
