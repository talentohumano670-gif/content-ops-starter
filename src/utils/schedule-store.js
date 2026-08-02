import fs from 'fs';
import path from 'path';

const LOCAL_DATA_DIR = path.join(process.cwd(), '.data', 'work-schedules');

function normalizeKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function keyToFileName(key) {
    return `${Buffer.from(key, 'utf8').toString('hex')}.json`;
}

function getLocalStore() {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    return {
        async get(key) {
            const filePath = path.join(LOCAL_DATA_DIR, keyToFileName(key));
            if (!fs.existsSync(filePath)) return null;
            const raw = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(raw);
        },
        async set(key, value) {
            const filePath = path.join(LOCAL_DATA_DIR, keyToFileName(key));
            fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
        }
    };
}

let cachedStore = null;

/**
 * Netlify Blobs backs this in production (real, non-git-committed storage that
 * survives across uploads/deploys). Falls back to a local JSON store on disk
 * so the feature is testable when there's no Netlify Blobs context (e.g. `npm run dev`
 * outside `netlify dev`).
 */
export function getScheduleStore() {
    if (cachedStore) return cachedStore;

    try {
        // eslint-disable-next-line global-require
        const { getStore } = require('@netlify/blobs');
        const store = getStore({ name: 'work-schedules', consistency: 'strong' });
        cachedStore = {
            async get(key) {
                return store.get(key, { type: 'json' });
            },
            async set(key, value) {
                return store.setJSON(key, value);
            }
        };
    } catch (err) {
        cachedStore = getLocalStore();
    }

    return cachedStore;
}

export { normalizeKey };
