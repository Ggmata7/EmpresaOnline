import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('passive cycle exits successfully before parsing sources or accessing services', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/run-cycle.mjs', import.meta.url))], {
    encoding: 'utf8', timeout: 5000,
    env: {
      ...process.env,
      COLLECTOR_MODE: 'legacy',
      AMAZON_BR_CREATORS_CLIENT_ID: '', AMAZON_BR_CREATORS_CLIENT_SECRET: '',
      AMAZON_US_CREATORS_CLIENT_ID: 'incomplete', AMAZON_US_CREATORS_CLIENT_SECRET: '',
      MERCADO_LIVRE_ACCESS_TOKEN: ' ', AMAZON_BR_TAG: 'example-20', AMAZON_US_TAG: 'example-20',
      DATABASE_URL: 'invalid-do-not-connect', SUPABASE_URL: 'invalid-do-not-connect',
      SUPABASE_SERVICE_ROLE_KEY: 'unused', SOURCES_JSON: '{invalid-json', ENABLE_WHATSAPP_DISPATCH: 'true',
    },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Modo passivo.*nenhuma escrita executada/);
  assert.equal(result.stdout, '');
});
