import { getScheduleStore, normalizeKey } from '../../../utils/schedule-store';
import { verifyPassword, signSession, serializeCookie, SESSION_COOKIE } from '../../../utils/schedule-auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Debes indicar usuario y contrasena.' });
    }

    const store = getScheduleStore();
    const index = (await store.get('users_index')) || { users: [] };
    const usernameKey = normalizeKey(username);
    const user = index.users.find((u) => normalizeKey(u.username) === usernameKey);

    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
        return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });
    }

    const unitsIndex = (await store.get('_units_index')) || { units: [] };
    const unidadLabels = user.unidades.map((key) => {
        const found = unitsIndex.units.find((u) => u.key === key);
        return found ? { key, unidad: found.unidad, cliente: found.cliente } : { key, unidad: key, cliente: '' };
    });

    // The session only carries identity; role/unidades are re-read from the live user
    // record on every request, so an admin edit or delete takes effect immediately.
    const token = signSession({ username: user.username });
    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, { maxAge: 12 * 60 * 60 }));

    return res.status(200).json({ ok: true, username: user.username, nombre: user.nombre, role: user.role, unidades: unidadLabels });
}
