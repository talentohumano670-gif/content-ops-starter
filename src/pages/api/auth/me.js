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

    const unitsIndex = (await store.get('_units_index')) || { units: [] };
    const unidadLabels = user.unidades.map((key) => {
        const found = unitsIndex.units.find((u) => u.key === key);
        return found ? { key, unidad: found.unidad, cliente: found.cliente } : { key, unidad: key, cliente: '' };
    });

    return res.status(200).json({
        username: user.username,
        nombre: user.nombre,
        role: user.role,
        unidades: unidadLabels
    });
}
