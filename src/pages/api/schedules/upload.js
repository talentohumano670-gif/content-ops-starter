import { getScheduleStore, normalizeKey } from '../../../utils/schedule-store';
import { parseScheduleWorkbook } from '../../../utils/schedule-excel';
import { verifyAdminKey, isAdminConfigured, hashPassword } from '../../../utils/schedule-auth';

const DEFAULT_AGENTE_PASSWORD = 'Liderman123';

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

    const store = getScheduleStore();

    if (!(await isAdminConfigured(store))) {
        return res.status(400).json({ error: 'Primero configura la clave de administrador en /horarios/admin.' });
    }
    if (!(await verifyAdminKey(req.body?.adminKey, store))) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
    }

    const { fileBase64, zonaKey } = req.body || {};
    if (!zonaKey) {
        return res.status(400).json({ error: 'Debes escoger una zona antes de subir el horario.' });
    }
    if (!fileBase64) {
        return res.status(400).json({ error: 'No se recibio ningun archivo.' });
    }

    const zonasIndex = (await store.get('_zonas_index')) || { zonas: [] };
    const zona = zonasIndex.zonas.find((z) => z.key === zonaKey);
    if (!zona) {
        return res.status(400).json({ error: 'La zona escogida no existe. Creala primero.' });
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

        const uploadedAt = new Date().toISOString();
        const unitsSummary = [];

        // Unit keys are scoped by zona (zona-key__nominativo-key) so the same post code
        // reused in two different zonas never collides and overwrites the other's schedule.
        for (const [nominativoKey, unit] of unitsMap.entries()) {
            const key = `${zonaKey}__${nominativoKey}`;
            await store.set(`unit:${key}`, { ...unit, zona: zona.nombre, responsable: zona.responsable, updatedAt: uploadedAt });
            unitsSummary.push({ key, unidad: unit.unidad, cliente: unit.cliente, zona: zona.nombre, responsable: zona.responsable });
        }

        const previousIndex = (await store.get('_units_index')) || { units: [] };
        const uploadedKeys = new Set(unitsSummary.map((u) => u.key));
        const keptFromBefore = previousIndex.units.filter((u) => !uploadedKeys.has(u.key));
        await store.set('_units_index', { units: [...keptFromBefore, ...unitsSummary], updatedAt: uploadedAt });

        // Every unit gets a default agente account (username = Nominativo, password Liderman123)
        // so credentials exist the moment a schedule is uploaded — no separate manual step.
        const usersIndex = (await store.get('users_index')) || { users: [] };
        const agentesCreados = [];
        const agentesOmitidos = [];

        for (const u of unitsSummary) {
            const usernameKey = normalizeKey(u.unidad);
            const existing = usersIndex.users.find((usr) => usr.usernameKey === usernameKey);
            if (existing) {
                if (existing.role === 'agente' && existing.unidades.includes(u.key)) continue; // already correctly linked
                agentesOmitidos.push({ usuario: u.unidad, motivo: 'Ya existe un usuario con ese nombre asignado a otra unidad.' });
                continue;
            }
            const { salt, hash } = hashPassword(DEFAULT_AGENTE_PASSWORD);
            usersIndex.users.push({
                username: u.unidad,
                usernameKey,
                passwordHash: hash,
                salt,
                role: 'agente',
                nombre: u.unidad,
                zona: '',
                allUnidades: false,
                unidades: [u.key]
            });
            agentesCreados.push({ usuario: u.unidad, clave: DEFAULT_AGENTE_PASSWORD });
        }

        if (agentesCreados.length > 0) {
            await store.set('users_index', usersIndex);
        }

        return res.status(200).json({
            ok: true,
            totalUnidades: unitsSummary.length,
            unidades: unitsSummary,
            agentesCreados,
            agentesOmitidos
        });
    } catch (err) {
        console.error(err);
        return res.status(400).json({ error: err.message || 'No se pudo procesar el archivo.' });
    }
}
