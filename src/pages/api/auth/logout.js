import { serializeCookie, SESSION_COOKIE } from '../../../utils/schedule-auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }
    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }));
    return res.status(200).json({ ok: true });
}
