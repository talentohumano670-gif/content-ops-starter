import crypto from 'crypto';
import { normalizeKey } from './schedule-store';

export const SESSION_COOKIE = 'schedule_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h: long enough for a shift, short enough to matter

/**
 * No environment variable is required to run this app: if neither SCHEDULE_SESSION_SECRET
 * nor SCHEDULE_ADMIN_KEY is set, a random secret is generated once and persisted in the
 * same store as everything else, so signing still works out of the box.
 */
async function getSessionSecret(store) {
    if (process.env.SCHEDULE_SESSION_SECRET) return process.env.SCHEDULE_SESSION_SECRET;
    if (process.env.SCHEDULE_ADMIN_KEY) return process.env.SCHEDULE_ADMIN_KEY;

    const existing = await store.get('_session_secret');
    if (existing?.secret) return existing.secret;

    const secret = crypto.randomBytes(32).toString('hex');
    await store.set('_session_secret', { secret });
    return secret;
}

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
    const candidate = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, 'hex');
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
}

export async function signSession(payload, store) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
    const secret = await getSessionSecret(store);
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export async function verifySession(token, store) {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const secret = await getSessionSecret(store);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload.exp || Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

export function serializeCookie(name, value, { maxAge } = {}) {
    let str = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
    if (typeof maxAge === 'number') str += `; Max-Age=${maxAge}`;
    if (process.env.NODE_ENV === 'production') str += '; Secure';
    return str;
}

export async function getSessionFromRequest(req, store) {
    const token = req.cookies?.[SESSION_COOKIE];
    return verifySession(token, store);
}

/**
 * Resolves the session's username against the live users_index rather than trusting
 * role/unidades baked into the signed token, so a deleted or reassigned account loses
 * access immediately instead of waiting out the token's TTL.
 */
export async function resolveSessionUser(req, store) {
    const session = await getSessionFromRequest(req, store);
    if (!session) return null;

    const index = (await store.get('users_index')) || { users: [] };
    const usernameKey = normalizeKey(session.username);
    const user = index.users.find((u) => normalizeKey(u.username) === usernameKey);
    if (!user) return null;

    return { username: user.username, nombre: user.nombre, role: user.role, unidades: user.unidades };
}

/**
 * Whether an administrador key has been established, either via the SCHEDULE_ADMIN_KEY
 * env var or through the in-app first-run setup (stored hashed in the same store).
 */
export async function isAdminConfigured(store) {
    if (process.env.SCHEDULE_ADMIN_KEY) return true;
    return Boolean(await store.get('_admin'));
}

export async function verifyAdminKey(providedKey, store) {
    if (!providedKey) return false;
    if (process.env.SCHEDULE_ADMIN_KEY) return providedKey === process.env.SCHEDULE_ADMIN_KEY;

    const admin = await store.get('_admin');
    if (!admin) return false;
    return verifyPassword(providedKey, admin.salt, admin.hash);
}
