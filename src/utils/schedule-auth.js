import crypto from 'crypto';
import { normalizeKey } from './schedule-store';

export const SESSION_COOKIE = 'schedule_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h: long enough for a shift, short enough to matter

function getSessionSecret() {
    const secret = process.env.SCHEDULE_SESSION_SECRET || process.env.SCHEDULE_ADMIN_KEY;
    if (!secret) {
        throw new Error('SCHEDULE_SESSION_SECRET (o SCHEDULE_ADMIN_KEY) no esta configurado.');
    }
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

export function signSession(payload) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
    const sig = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function verifySession(token) {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
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

export function getSessionFromRequest(req) {
    const token = req.cookies?.[SESSION_COOKIE];
    return verifySession(token);
}

/**
 * Resolves the session's username against the live users_index rather than trusting
 * role/unidades baked into the signed token, so a deleted or reassigned account loses
 * access immediately instead of waiting out the token's TTL.
 */
export async function resolveSessionUser(req, store) {
    const session = getSessionFromRequest(req);
    if (!session) return null;

    const index = (await store.get('users_index')) || { users: [] };
    const usernameKey = normalizeKey(session.username);
    const user = index.users.find((u) => normalizeKey(u.username) === usernameKey);
    if (!user) return null;

    return { username: user.username, nombre: user.nombre, role: user.role, unidades: user.unidades };
}
