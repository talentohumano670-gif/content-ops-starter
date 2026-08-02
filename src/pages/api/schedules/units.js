import { getScheduleStore } from '../../../utils/schedule-store';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    const adminKey = process.env.SCHEDULE_ADMIN_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
    }

    try {
        const store = getScheduleStore();
        const index = (await store.get('_units_index')) || { units: [] };
        return res.status(200).json({ units: index.units, updatedAt: index.updatedAt || null });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo consultar la lista de unidades.' });
    }
}
