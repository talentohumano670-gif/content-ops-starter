import { getScheduleStore } from '../../../utils/schedule-store';
import { parseScheduleWorkbook } from '../../../utils/schedule-excel';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb'
        }
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    const adminKey = process.env.SCHEDULE_ADMIN_KEY;
    if (!adminKey) {
        return res.status(500).json({ error: 'El servidor no tiene configurada la clave de administrador (SCHEDULE_ADMIN_KEY).' });
    }
    if (req.body?.adminKey !== adminKey) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
    }

    const { fileBase64 } = req.body || {};
    if (!fileBase64) {
        return res.status(400).json({ error: 'No se recibio ningun archivo.' });
    }

    try {
        const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        const bytes = new Uint8Array(Buffer.from(base64Data, 'base64'));

        const unitsMap = parseScheduleWorkbook(bytes);
        if (unitsMap.size === 0) {
            return res.status(400).json({
                error: 'No se encontraron unidades reconocibles. El archivo debe seguir el formato "Horario Detallado de Unidades" (con filas Cliente:/Nominativo:/Servicio:).'
            });
        }

        const store = getScheduleStore();
        const uploadedAt = new Date().toISOString();
        const unitsSummary = [];

        for (const [key, unit] of unitsMap.entries()) {
            await store.set(`unit:${key}`, { ...unit, updatedAt: uploadedAt });
            unitsSummary.push({ key, unidad: unit.unidad, cliente: unit.cliente, zona: unit.zona });
        }

        const previousIndex = (await store.get('_units_index')) || { units: [] };
        const uploadedKeys = new Set(unitsSummary.map((u) => u.key));
        const keptFromBefore = previousIndex.units.filter((u) => !uploadedKeys.has(u.key));
        await store.set('_units_index', { units: [...keptFromBefore, ...unitsSummary], updatedAt: uploadedAt });

        return res.status(200).json({ ok: true, totalUnidades: unitsSummary.length, unidades: unitsSummary });
    } catch (err) {
        console.error(err);
        return res.status(400).json({ error: err.message || 'No se pudo procesar el archivo.' });
    }
}
