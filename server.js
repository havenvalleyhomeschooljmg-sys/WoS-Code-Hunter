const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;

if (fs.existsSync('.env') && fs.statSync('.env').isFile()) {
  process.loadEnvFile('.env');
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const validCode = s =>
  typeof s === 'string' && /^[A-Za-z0-9_-]{4,32}$/.test(s);

const send = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
};

const rate = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (rate.get(ip) || []).filter(t => now - t < 3600000);

  if (recent.length >= 20) return true;

  recent.push(now);
  rate.set(ip, recent);
  return false;
}

function formatCode(item) {
  return {
    code: item.code,
    source: item.source || 'Community submission',
    sources: item.sources || [],
    added: item.first_seen,
    lastSeen: item.last_seen,
    yes: item.yes_votes,
    no: item.no_votes,
    community: item.community,
    status: item.status
  };
}

async function getCodes() {
  const { data, error } = await supabase
    .from('gift_codes')
    .select('*')
    .order('first_seen', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data.map(formatCode);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2048) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/codes') {
      const codes = await getCodes();

      return send(res, 200, {
        codes,
        lastScan: null,
        scanNote: 'Community records stored in Supabase. Automatic discovery integration pending.'
      });
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      const { count, error } = await supabase
        .from('gift_codes')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      return send(res, 200, {
        records: count,
        storage: 'Supabase PostgreSQL',
        databaseConnected: true
      });
    }

    if (req.method === 'POST' &&
        ['/api/submit', '/api/vote'].includes(pathname)) {

      const ip = req.socket.remoteAddress || 'unknown';

      if (limited(ip)) {
        return send(res, 429, {
          error: 'Please try again later.'
        });
      }

      let body;

      try {
        body = await readBody(req);
      } catch {
        return send(res, 400, {
          error: 'Invalid request.'
        });
      }

      if (pathname === '/api/submit') {
        const code = String(body.code || '').trim();

        if (!validCode(code)) {
          return send(res, 400, {
            error: 'Enter a 4–32 character code (letters, numbers, - or _).'
          });
        }

        const { data: existing, error: lookupError } = await supabase
          .from('gift_codes')
          .select('id')
          .ilike('code', code)
          .limit(1);

        if (lookupError) throw lookupError;

        if (existing.length) {
          return send(res, 409, {
            error: 'This code is already listed.'
          });
        }

        const { error } = await supabase
          .from('gift_codes')
          .insert({
            code,
            source: 'Community submission',
            sources: [],
            community: true,
            status: 'unverified'
          });

        if (error) {
          if (error.code === '23505') {
            return send(res, 409, {
              error: 'This code is already listed.'
            });
          }
          throw error;
        }

        return send(res, 200, { ok: true });
      }

      if (!validCode(body.code) ||
          !['yes', 'no'].includes(body.vote)) {
        return send(res, 400, {
          error: 'Invalid vote.'
        });
      }

      const { data: existing, error: lookupError } = await supabase
        .from('gift_codes')
        .select('id')
        .ilike('code', body.code)
        .limit(1);

      if (lookupError) throw lookupError;

      if (!existing.length) {
        return send(res, 400, {
          error: 'Invalid vote.'
        });
      }

      const { error } = await supabase.rpc('record_code_vote', {
        p_code: body.code,
        p_vote: body.vote
      });

      if (error) throw error;

      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/scan' &&
        req.method === 'POST') {
      return send(res, 503, {
        error: 'Automatic scanning is not connected yet.'
      });
    }

    return send(res, 404, { error: 'API endpoint not found' });

  } catch (error) {
    console.error('API error:', error.message);

    return send(res, 503, {
      error: 'Database operation unavailable. Please try again.'
    });
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png'
};

const publicRoot = path.resolve(__dirname, 'public');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname.startsWith('/api/')) {
    handleApi(req, res, u.pathname);
    return;
  }

  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  let pathname;

  try {
    pathname = decodeURIComponent(u.pathname);
  } catch {
    return send(res, 400, { error: 'Invalid path' });
  }

  const relative = pathname === '/'
    ? 'index.html'
    : pathname.replace(/^\/+/, '');

  const filePath = path.resolve(publicRoot, relative);

  if (!filePath.startsWith(publicRoot + path.sep)) {
    return send(res, 404, { error: 'Not found' });
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      return send(res, 404, { error: 'Not found' });
    }

    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath)] ||
        'application/octet-stream'
    });

    res.end(content);
  });

}).listen(PORT, () => {
  console.log('WoS Code Hunter running on port ' + PORT);
  console.log('Storage: Supabase PostgreSQL');
});