import { getScheduleStore } from '../../../utils/schedule-store';
import { resolveSessionUser } from '../../../utils/schedule-auth';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    const store = getScheduleStore();
    const user = await resolveSessionUser(req, store);
    if (!user) {
        return res.status(401).json({ error: 'No hay sesion activa.' });
    }

    // Only ever reads the unit keys on this user's live record — never a client-supplied
    // list — so a supervisor/agente can only ever pull the units they're currently assigned to.
    const schedules = [];
    for (const key of user.unidades) {
        const unit = await store.get(`unit:${key}`);
        if (unit) schedules.push({ key, ...unit });
    }

    return res.status(200).json({ role: user.role, nombre: user.nombre, schedules });
}
