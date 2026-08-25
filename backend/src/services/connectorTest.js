const crypto = require('crypto');
const fetch = require('node-fetch');

const S3_COMPAT = new Set([
  'Amazon S3',
  'Cloudflare R2',
  'Backblaze B2',
  'DigitalOcean Spaces',
  'Wasabi',
  'Supabase',
  'MinIO (Self-hosted)',
]);

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function amzDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amz: iso.slice(0, 16), day: iso.slice(0, 8) };
}

/**
 * Minimal SigV4 ListObjectsV2 for S3-compatible endpoints (POC test).
 */
async function listS3Objects({ accessKey, secretKey, bucket, region, endpoint }) {
  const reg = region && region !== 'auto' ? region : 'us-east-1';
  const hostBase = String(endpoint || `https://s3.${reg}.amazonaws.com`).replace(/\/$/, '');
  const url = new URL(`${hostBase}/${encodeURIComponent(bucket)}?list-type=2&max-keys=5`);
  const host = url.host;
  const canonicalUri = url.pathname;
  const canonicalQuery = url.searchParams.toString().split('&').sort().join('&');
  const { amz, day } = amzDate();
  const payloadHash = sha256('');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${day}/${reg}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, credentialScope, sha256(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${secretKey}`, day);
  const kRegion = hmac(kDate, reg);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Host: host,
      'x-amz-date': amz,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    },
  });
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(text.slice(0, 240) || `S3 list failed (${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  const keys = [...text.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  return { count: keys.length, sample: keys.slice(0, 5) };
}

async function pingUrl(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: controller ? controller.signal : undefined,
    });
    return { status: resp.status, ok: resp.status < 500 };
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'Endpoint timed out' : err.message || 'Endpoint unreachable');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function testStorageConnector(provider, config = {}) {
  const accessKey = config.accessKeyId || config.clientId || '';
  const secretKey = config.secretAccessKey || config.clientSecret || '';
  const bucket = config.bucketName || config.bucket || '';
  const region = config.region || 'auto';
  const endpoint = config.endpointUrl || config.endpoint || '';

  if (!bucket) throw new Error('Bucket name is required');
  if (!accessKey || !secretKey) throw new Error('Access key and secret are required');

  if (S3_COMPAT.has(provider) || provider === 'Google Cloud Storage') {
    try {
      const result = await listS3Objects({ accessKey, secretKey, bucket, region, endpoint });
      return {
        status: 'ACTIVE',
        message: `Connected to ${provider}. Listed ${result.count} object(s).`,
        recordCount: result.count,
      };
    } catch (err) {
      // Fallback: endpoint reachability still useful for POC
      if (endpoint) {
        const ping = await pingUrl(endpoint);
        if (ping.ok) {
          return {
            status: 'CONFIGURED',
            message: `Endpoint reachable, but bucket auth failed: ${err.message}`,
            recordCount: 0,
          };
        }
      }
      throw err;
    }
  }

  if (provider === 'Azure Blob Storage') {
    if (!endpoint) throw new Error('Endpoint URL is required for Azure Blob Storage');
    const ping = await pingUrl(endpoint);
    return {
      status: ping.ok ? 'ACTIVE' : 'ERROR',
      message: ping.ok
        ? 'Azure endpoint reachable. Credentials saved for Blob access.'
        : `Azure endpoint returned HTTP ${ping.status}`,
      recordCount: 0,
    };
  }

  return {
    status: 'CONFIGURED',
    message: `${provider} credentials saved.`,
    recordCount: 0,
  };
}

async function testSystemConnector(category, config = {}) {
  const baseUrl = config.baseUrl || config.apiUrl || '';
  if (!baseUrl) {
    return {
      status: 'CONFIGURED',
      message: `${category.toUpperCase()} connector saved. Add Base URL to enable live test.`,
      recordCount: 0,
    };
  }
  const ping = await pingUrl(baseUrl);
  return {
    status: ping.ok ? 'ACTIVE' : 'ERROR',
    message: ping.ok
      ? `${category.toUpperCase()} endpoint reachable (${ping.status}).`
      : `${category.toUpperCase()} endpoint returned HTTP ${ping.status}`,
    recordCount: 0,
  };
}

async function testConnector({ category, provider, config }) {
  if (category === 'storage') return testStorageConnector(provider, config);
  return testSystemConnector(category || provider, config);
}

module.exports = {
  testConnector,
  S3_COMPAT,
};
