import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const sources = [
  'https://www.gamesradar.com/games/survival/whiteout-survival-codes-gift/'
];

const file = new URL('../data/discovered.json', import.meta.url);
const now = new Date().toISOString();
const failures = [];
const records = new Map();
let checked = 0;

function plain(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function candidates(html) {
  const found = new Set();

  const headings = [...html.matchAll(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi)];

const expiredHeading = headings.find(h =>
  /expired\s+(?:whiteout\s+survival\s+)?codes/i.test(plain(h[0]))
);

const expired = expiredHeading ? expiredHeading.index : -1;

const active = expired >= 0 ? html.slice(0, expired) : html;
const items = active.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];

  const ignored = new Set([
    'listed', 'center', 'field', 'right', 'history',
    'rewards', 'redeem', 'working', 'active', 'expired',
    'available', 'survival', 'whiteout', 'website',
    'official', 'updated', 'settings', 'android', 'iphone'
  ]);

  for (const item of items) {
    if (/<(?:del|s|strike)\b/i.test(item)) continue;

  const match = item.match(
  /<li\b[^>]*>\s*<strong\b[^>]*>\s*([A-Za-z0-9]{5,24})\s*<\/strong>\s*[–—-]\s*\S/i
);

    if (!match) continue;

    const code = match[1];

    if (!ignored.has(code.toLowerCase())) {
      found.add(code);
    }
  }

  return [...found];
}

for (const url of sources) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WoSCodeHunter/2.0 (public gift-code discovery)',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const html = await response.text();
    checked++;

    const found = candidates(html);
    console.log('Found on source: ' + found.length);

    for (const code of found) {
      records.set(code.toLowerCase(), {
        code,
        source: url,
        sources: [url],
        added: now,
        lastSeen: now,
        yes: 0,
        no: 0,
        community: false,
        status: 'unverified'
      });
    }
  } catch (error) {
    failures.push({
      source: url,
      error: String(error.message)
    });
  }
}

const codes = [...records.values()];
let inserted = 0;
let alreadyListed = 0;

for (const item of codes) {
  const { data: existing, error: lookupError } = await supabase
    .from('gift_codes')
    .select('id')
    .ilike('code', item.code)
    .limit(1);

  if (lookupError) throw lookupError;

  if (existing && existing.length > 0) {
    alreadyListed++;
    continue;
  }

  const { error: insertError } = await supabase
    .from('gift_codes')
    .insert({
      code: item.code,
      source: item.source,
      sources: item.sources,
      community: false,
      status: 'unverified'
    });

  if (insertError) {
    if (insertError.code === '23505') {
      alreadyListed++;
      continue;
    }
    throw insertError;
  }

  inserted++;
}

console.log(
  'Supabase: ' + inserted + ' new codes, ' +
  alreadyListed + ' already listed'
);

await fs.mkdir(new URL('../data/', import.meta.url), {
  recursive: true
});

await fs.writeFile(
  file,
  JSON.stringify({
    codes,
    lastScan: now,
    scanNote: 'Source-reported candidates only; not game-verified.',
    failures
  }, null, 2) + '\n'
);

console.log(
  'Checked ' + checked + '/' + sources.length +
  ', ' + codes.length + ' candidates, ' +
  failures.length + ' errors'
);