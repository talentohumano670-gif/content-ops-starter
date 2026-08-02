import { getScheduleStore } from '../../../utils/schedule-store';
import { hashPassword, verifyPassword } from '../../../utils/schedule-auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    if (process.env.SCHEDULE_ADMIN_KEY) {
        return res.status(400).json({ error: 'La clave de administrador esta definida por variable de entorno (SCHEDULE_ADMIN_KEY); cambiala ahi.' });
    }

    const { newKey, currentKey } = req.body || {};
    if (!newKey || newKey.length < 6) {
        return res.status(400).json({ error: 'La nueva clave debe tener al menos 6 caracteres.' });
    }

    const store = getScheduleStore();
    const existing = await store.get('_admin');

    if (existing) {
        if (!currentKey || !verifyPassword(currentKey, existing.salt, existing.hash)) {
            return res.status(401).json({ error: 'La clave actual es incorrecta.' });
        }
    }

    const { salt, hash } = hashPassword(newKey);
    await store.set('_admin', { salt, hash });

    return res.status(200).json({ ok: true });
}
