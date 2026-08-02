import { getScheduleStore } from '../../../utils/schedule-store';
import { isAdminConfigured } from '../../../utils/schedule-auth';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo no permitido' });
    }

    const store = getScheduleStore();
    const configured = await isAdminConfigured(store);
    // envManaged tells the UI the key lives in an env var (change-in-app is disabled).
    return res.status(200).json({ configured, envManaged: Boolean(process.env.SCHEDULE_ADMIN_KEY) });
}
