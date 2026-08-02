import { getScheduleStore, normalizeKey } from '../../utils/schedule-store';
import { verifyAdminKey } from '../../utils/schedule-auth';

export default async function handler(req, res) {
    const store = getScheduleStore();

    if (!(await verifyAdminKey(req.headers['x-admin-key'], store))) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
    }

    if (req.method === 'GET') {
        const index = (await store.get('_zonas_index')) || { zonas: [] };
        return res.status(200).json({ zonas: index.zonas });
    }

    if (req.method === 'POST') {
        const { nombre, responsable } = req.body || {};
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'Debes indicar el nombre de la zona.' });
        }

        const key = normalizeKey(nombre);
        const index = (await store.get('_zonas_index')) || { zonas: [] };
        const existingIdx = index.zonas.findIndex((z) => z.key === key);
        const zona = { key, nombre: nombre.trim(), responsable: responsable?.trim() || '' };

        if (existingIdx >= 0) {
            index.zonas[existingIdx] = zona;
        } else {
            index.zonas.push(zona);
        }
        await store.set('_zonas_index', index);

        return res.status(200).json({ ok: true, zona });
    }

    if (req.method === 'DELETE') {
        const key = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
        if (!key) {
            return res.status(400).json({ error: 'Debes indicar la zona a eliminar.' });
        }
        const index = (await store.get('_zonas_index')) || { zonas: [] };
        const nextZonas = index.zonas.filter((z) => z.key !== key);
        if (nextZonas.length === index.zonas.length) {
            return res.status(404).json({ error: 'Zona no encontrada.' });
        }
        await store.set('_zonas_index', { zonas: nextZonas });
        return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Metodo no permitido' });
}
