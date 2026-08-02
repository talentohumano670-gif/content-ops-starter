import { getScheduleStore } from '../../../utils/schedule-store';
import { verifyAdminKey } from '../../../utils/schedule-auth';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    const store = getScheduleStore();
    if (!(await verifyAdminKey(req.headers['x-admin-key'], store))) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
    }

    try {
        const index = (await store.get('_units_index')) || { units: [] };
        return res.status(200).json({ units: index.units, updatedAt: index.updatedAt || null });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo consultar la lista de unidades.' });
    }
}
