const http = require('node:http');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;

function loadEnvFile() {
    const envPath = path.join(ROOT, '.env');
    if (!fsSync.existsSync(envPath)) return;

    const lines = fsSync.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const equals = trimmed.indexOf('=');
        if (equals === -1) continue;

        const key = trimmed.slice(0, equals).trim();
        let value = trimmed.slice(equals + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const NABOOPAY_API_KEY = process.env.NABOOPAY_API_KEY || '';
const NABOOPAY_WEBHOOK_SECRET = process.env.NABOOPAY_WEBHOOK_SECRET || '';
const NABOOPAY_API_URL = process.env.NABOOPAY_API_URL || 'https://api.naboopay.com/api/v2/transactions';
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
const FREE_SHIPPING_FROM = 15000;
const SHIPPING_FEE = 2500;

const CATALOG = {
    moulynak: {
        name: 'Moulynak',
        prices: { '100 g': 900, '250 g': 2000, '400 g': 3600, '1 kg': 7600 },
    },
    farine: {
        name: 'Farine de Mil Enrichie',
        prices: { '250 g': 650, '500 g': 1250 },
    },
    marmite: {
        name: 'Marmite en Terre Cuite',
        prices: { Petite: 8500, Moyenne: 14000, Grande: 20000 },
    },
};

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function cleanText(value, max = 120) {
    return String(value || '').trim().slice(0, max);
}

function normalizePhone(value) {
    const raw = cleanText(value, 30).replace(/[\s.-]/g, '');
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    if (raw.startsWith('00')) return `+${raw.slice(2)}`;
    if (raw.startsWith('221')) return `+${raw}`;
    if (/^\d{9}$/.test(raw)) return `+221${raw}`;
    return raw;
}

function getOrigin(req) {
    if (PUBLIC_SITE_URL) return PUBLIC_SITE_URL;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
}

function normalizeItems(items) {
    if (!Array.isArray(items)) throw new Error('Panier invalide.');

    const grouped = new Map();
    for (const item of items) {
        const id = cleanText(item.id, 40);
        const size = cleanText(item.size, 40);
        const qty = Number(item.qty);
        const product = CATALOG[id];

        if (!product || !Object.prototype.hasOwnProperty.call(product.prices, size)) {
            throw new Error('Un produit du panier est invalide.');
        }

        if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
            throw new Error('Une quantite du panier est invalide.');
        }

        const key = `${id}_${size}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.qty += qty;
        } else {
            grouped.set(key, {
                id,
                size,
                qty,
                name: product.name,
                price: product.prices[size],
            });
        }
    }

    return [...grouped.values()];
}

function buildNabooPayPayload(req, body) {
    const items = normalizeItems(body.items);
    if (!items.length) throw new Error('Votre panier est vide.');

    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
    const origin = getOrigin(req);

    if (!/^https?:\/\/.+/i.test(origin)) {
        throw new Error('PUBLIC_SITE_URL doit etre une URL HTTP/HTTPS valide.');
    }

    const products = items.map(item => ({
        name: `${item.name} - ${item.size}`,
        category: item.id,
        amount: item.price,
        quantity: item.qty,
        description: `Commande CYCAS: ${item.name} ${item.size}`,
    }));

    if (shipping > 0) {
        products.push({
            name: 'Livraison',
            category: 'shipping',
            amount: shipping,
            quantity: 1,
            description: 'Frais de livraison CYCAS',
        });
    }

    const customer = body.customer || {};
    const payload = {
        method_of_payment: ['wave', 'orange_money'],
        products,
        success_url: `${origin}/checkout.html?payment=success`,
        error_url: `${origin}/checkout.html?payment=error`,
    };

    const phone = normalizePhone(customer.phone);
    if (phone || customer.first_name || customer.last_name) {
        payload.customer = {
            first_name: cleanText(customer.first_name, 80),
            last_name: cleanText(customer.last_name, 80),
            phone,
        };
    }

    return { payload, subtotal, shipping, total: subtotal + shipping };
}

async function createNabooPayTransaction(req, res) {
    if (!NABOOPAY_API_KEY) {
        sendJson(res, 500, { error: 'NABOOPAY_API_KEY est manquant cote serveur.' });
        return;
    }

    let body;
    try {
        body = JSON.parse(await readBody(req) || '{}');
    } catch {
        sendJson(res, 400, { error: 'JSON invalide.' });
        return;
    }

    let transaction;
    try {
        transaction = buildNabooPayPayload(req, body);
    } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
    }

    try {
        const response = await fetch(NABOOPAY_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${NABOOPAY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transaction.payload),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            sendJson(res, response.status >= 500 ? 502 : response.status, {
                error: result.error || 'La creation du paiement NabooPay a echoue.',
            });
            return;
        }

        const orderId = result.order_id || result.orderId || '';
        const checkoutUrl =
            result.checkout_url ||
            result.checkoutUrl ||
            result.checkout ||
            result.payment_url ||
            result.url ||
            (orderId ? `https://checkout.naboopay.com/checkout/${orderId}` : '');

        if (!checkoutUrl) {
            sendJson(res, 502, { error: 'NabooPay n a pas renvoye d URL de paiement.' });
            return;
        }

        sendJson(res, 200, {
            checkout_url: checkoutUrl,
            order_id: orderId,
            total: transaction.total,
        });
    } catch (error) {
        sendJson(res, 502, { error: `NabooPay est indisponible: ${error.message}` });
    }
}

function verifyWebhookSignature(payload, signature) {
    if (!NABOOPAY_WEBHOOK_SECRET || !signature) return false;
    const expected = crypto
        .createHmac('sha256', NABOOPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function handleNabooPayWebhook(req, res) {
    if (!NABOOPAY_WEBHOOK_SECRET) {
        sendJson(res, 500, { error: 'NABOOPAY_WEBHOOK_SECRET est manquant cote serveur.' });
        return;
    }

    let payload;
    try {
        payload = JSON.parse(await readBody(req) || '{}');
    } catch {
        sendJson(res, 400, { error: 'JSON invalide.' });
        return;
    }

    const signature = req.headers['x-signature'];
    if (!verifyWebhookSignature(payload, Array.isArray(signature) ? signature[0] : signature)) {
        sendJson(res, 401, { error: 'Signature NabooPay invalide.' });
        return;
    }

    console.log('NabooPay webhook', {
        order_id: payload.order_id,
        transaction_status: payload.transaction_status,
        selected_payment_method: payload.selected_payment_method,
        amount: payload.amount,
    });

    sendJson(res, 200, { status: 'received' });
}

async function serveStatic(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    const safeRoot = path.resolve(ROOT);
    const filePath = path.resolve(safeRoot, `.${pathname}`);
    const rootPrefix = safeRoot.endsWith(path.sep) ? safeRoot : `${safeRoot}${path.sep}`;
    if (filePath !== safeRoot && !filePath.startsWith(rootPrefix)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
    }
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/api/checkout/naboopay') {
        await createNabooPayTransaction(req, res);
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/webhooks/naboopay') {
        await handleNabooPayWebhook(req, res);
        return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStatic(req, res);
        return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
    console.log(`CYCAS server: http://localhost:${PORT}`);
});
