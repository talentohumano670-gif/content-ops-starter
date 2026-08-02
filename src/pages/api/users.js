import { getScheduleStore, normalizeKey } from '../../utils/schedule-store';
import { hashPassword } from '../../utils/schedule-auth';

const VALID_ROLES = ['supervisor', 'agente'];

function requireAdmin(req) {
    const adminKey = process.env.SCHEDULE_ADMIN_KEY;
    return Boolean(adminKey) && req.headers['x-admin-key'] === adminKey;
}

function toPublicUser(user) {
    const { passwordHash, salt, ...rest } = user;
    return rest;
}

export default async function handler(req, res) {
    if (!requireAdmin(req)) {
        return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
    }

    const store = getScheduleStore();

    if (req.method === 'GET') {
        const index = (await store.get('users_index')) || { users: [] };
        return res.status(200).json({ users: index.users.map(toPublicUser) });
    }

    if (req.method === 'POST') {
        const { username, password, role, nombre, unidades } = req.body || {};
        if (!username || !password || !role || !Array.isArray(unidades) || unidades.length === 0) {
            return res.status(400).json({ error: 'Faltan campos: usuario, contrasena, rol y al menos una unidad.' });
        }
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: `El rol debe ser uno de: ${VALID_ROLES.join(', ')}.` });
        }
        if (role === 'agente' && unidades.length > 1) {
            return res.status(400).json({ error: 'Un agente solo puede tener asignada una unidad.' });
        }

        const usernameKey = normalizeKey(username);
        const index = (await store.get('users_index')) || { users: [] };
        if (index.users.some((u) => normalizeKey(u.username) === usernameKey)) {
            return res.status(409).json({ error: 'Ya existe un usuario con ese nombre.' });
        }

        const { salt, hash } = hashPassword(password);
        const newUser = {
            username: username.trim(),
            usernameKey,
            passwordHash: hash,
            salt,
            role,
            nombre: nombre?.trim() || username.trim(),
            unidades
        };
        index.users.push(newUser);
        await store.set('users_index', index);

        return res.status(201).json({ ok: true, user: toPublicUser(newUser) });
    }

    if (req.method === 'DELETE') {
        const username = Array.isArray(req.query.username) ? req.query.username[0] : req.query.username;
        if (!username) {
            return res.status(400).json({ error: 'Debes indicar el usuario a eliminar.' });
        }
        const usernameKey = normalizeKey(username);
        const index = (await store.get('users_index')) || { users: [] };
        const nextUsers = index.users.filter((u) => normalizeKey(u.username) !== usernameKey);
        if (nextUsers.length === index.users.length) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        await store.set('users_index', { users: nextUsers });
        return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Metodo no permitido' });
}
