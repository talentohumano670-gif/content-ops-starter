import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useTheme } from '../../utils/use-theme';

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function ThemeToggle({ theme, toggleTheme }) {
    return (
        <button
            onClick={toggleTheme}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200"
        >
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
    );
}

function ZonaPicker({ adminKey, zonas, setZonas, zonaKey, setZonaKey }) {
    const [showNew, setShowNew] = useState(false);
    const [nombre, setNombre] = useState('');
    const [responsable, setResponsable] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleCreateZona(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/zonas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
                body: JSON.stringify({ nombre, responsable })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setZonas((prev) => [...prev.filter((z) => z.key !== data.zona.key), data.zona]);
            setZonaKey(data.zona.key);
            setNombre('');
            setResponsable('');
            setShowNew(false);
        } catch (err) {
            setError(err.message || 'No se pudo crear la zona.');
        } finally {
            setSaving(false);
        }
    }

    const selected = zonas.find((z) => z.key === zonaKey);

    return (
        <div className="mb-4">
            <span className="text-sm font-medium block mb-1">Zona</span>
            <div className="flex gap-2 items-start">
                <select
                    value={zonaKey}
                    onChange={(e) => setZonaKey(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2 flex-1"
                >
                    <option value="">Selecciona una zona...</option>
                    {zonas.map((z) => (
                        <option key={z.key} value={z.key}>
                            {z.nombre} {z.responsable ? `— Responsable: ${z.responsable}` : ''}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    + Nueva zona
                </button>
            </div>
            {selected && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Todas las unidades de este archivo quedaran marcadas como {selected.nombre}.
                </p>
            )}

            {showNew && (
                <form onSubmit={handleCreateZona} className="mt-3 flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded p-3 max-w-md">
                    <input
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Nombre de la zona (ej: Zona 3)"
                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2 text-sm"
                        required
                    />
                    <input
                        value={responsable}
                        onChange={(e) => setResponsable(e.target.value)}
                        placeholder="Responsable de la zona"
                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2 text-sm"
                        required
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-slate-800 text-white px-4 py-1.5 rounded text-sm hover:bg-slate-900 disabled:opacity-50 self-start"
                    >
                        {saving ? 'Guardando...' : 'Guardar zona'}
                    </button>
                    {error && <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>}
                </form>
            )}
        </div>
    );
}

function UploadPanel({ adminKey }) {
    const [file, setFile] = useState(null);
    const [zonas, setZonas] = useState([]);
    const [zonaKey, setZonaKey] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        fetch('/api/zonas', { headers: { 'x-admin-key': adminKey } })
            .then((res) => res.json())
            .then((data) => setZonas(data.zonas || []))
            .catch(() => {});
    }, [adminKey]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!zonaKey) {
            setStatus('error');
            setMessage('Escoge (o crea) la zona de este horario.');
            return;
        }
        if (!file) {
            setStatus('error');
            setMessage('Selecciona un archivo Excel (.xlsx).');
            return;
        }
        setStatus('loading');
        setMessage('');
        setSummary(null);
        try {
            const fileBase64 = await readFileAsBase64(file);
            const res = await fetch('/api/schedules/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminKey, fileBase64, zonaKey })
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'No se pudo subir el archivo.');
                return;
            }
            setStatus('success');
            setSummary(data);
        } catch {
            setStatus('error');
            setMessage('No se pudo conectar con el servidor.');
        }
    }

    return (
        <div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Sube el archivo Excel &quot;Horario Detallado de Unidades&quot; (una hoja por mes). El sistema detecta
                automaticamente cada unidad (Nominativo) por cliente, con sus turnos diarios.
            </p>

            <ZonaPicker adminKey={adminKey} zonas={zonas} setZonas={setZonas} zonaKey={zonaKey} setZonaKey={setZonaKey} />

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-4 py-2"
                    required
                />
                <button
                    type="submit"
                    disabled={status === 'loading' || !zonaKey}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
                >
                    {status === 'loading' ? 'Subiendo...' : 'Subir horarios'}
                </button>
            </form>

            {status === 'error' && (
                <p className="mt-6 text-red-700 bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-200 rounded px-4 py-3">
                    {message}
                </p>
            )}

            {status === 'success' && summary && (
                <div className="mt-6 flex flex-col gap-4">
                    <div className="text-green-800 bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800 dark:text-green-200 rounded px-4 py-3">
                        <p className="font-medium mb-2">{summary.totalUnidades} unidad(es) actualizada(s) correctamente.</p>
                        <ul className="list-disc list-inside text-sm max-h-64 overflow-y-auto">
                            {summary.unidades.map((u) => (
                                <li key={u.key}>
                                    {u.unidad} — {u.cliente}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {summary.agentesCreados?.length > 0 && (
                        <div className="text-blue-900 bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200 rounded px-4 py-3">
                            <p className="font-medium mb-2">
                                Se crearon {summary.agentesCreados.length} usuario(s) agente por defecto (clave: <code>Liderman123</code>):
                            </p>
                            <div className="overflow-x-auto">
                                <table className="text-sm">
                                    <thead>
                                        <tr className="text-left">
                                            <th className="pr-4">Usuario</th>
                                            <th>Clave</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.agentesCreados.map((a) => (
                                            <tr key={a.usuario}>
                                                <td className="pr-4 font-mono">{a.usuario}</td>
                                                <td className="font-mono">{a.clave}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {summary.agentesOmitidos?.length > 0 && (
                        <div className="text-amber-800 bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200 rounded px-4 py-3">
                            <p className="font-medium mb-2">No se crearon {summary.agentesOmitidos.length} usuario(s) agente (nombre ya en uso):</p>
                            <ul className="list-disc list-inside text-sm">
                                {summary.agentesOmitidos.map((a) => (
                                    <li key={a.usuario}>
                                        {a.usuario}: {a.motivo}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function UsersPanel({ adminKey }) {
    const [units, setUnits] = useState([]);
    const [zonas, setZonas] = useState([]);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');

    const [username, setUsername] = useState('');
    const [nombre, setNombre] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('agente');
    const [zona, setZona] = useState(''); // supervisor's zona of responsibility (dynamic scope)
    const [allUnidades, setAllUnidades] = useState(false); // supervisor: every unit, dynamic scope
    const [selectedUnits, setSelectedUnits] = useState([]); // manual pick (agente, or supervisor without a zona)
    const [creating, setCreating] = useState(false);

    async function loadData() {
        setError('');
        try {
            const [unitsRes, zonasRes, usersRes] = await Promise.all([
                fetch('/api/schedules/units', { headers: { 'x-admin-key': adminKey } }),
                fetch('/api/zonas', { headers: { 'x-admin-key': adminKey } }),
                fetch('/api/users', { headers: { 'x-admin-key': adminKey } })
            ]);
            const unitsData = await unitsRes.json();
            const zonasData = await zonasRes.json();
            const usersData = await usersRes.json();
            if (!unitsRes.ok) throw new Error(unitsData.error);
            if (!zonasRes.ok) throw new Error(zonasData.error);
            if (!usersRes.ok) throw new Error(usersData.error);
            setUnits(unitsData.units);
            setZonas(zonasData.zonas);
            setUsers(usersData.users);
        } catch (err) {
            setError(err.message || 'No se pudo cargar la informacion.');
        }
    }

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function toggleUnit(key) {
        setZona('');
        setAllUnidades(false);
        setSelectedUnits((prev) => {
            if (role === 'agente') return prev.includes(key) ? [] : [key];
            return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        });
    }

    function pickZona(zonaNombre) {
        setZona(zonaNombre);
        setAllUnidades(false);
        setSelectedUnits([]);
    }

    function pickAllUnidades() {
        setAllUnidades(true);
        setZona('');
        setSelectedUnits([]);
    }

    async function handleCreate(e) {
        e.preventDefault();
        setCreating(true);
        setError('');
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
                body: JSON.stringify({ username, password, nombre, role, zona, allUnidades, unidades: selectedUnits })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setUsername('');
            setNombre('');
            setPassword('');
            setZona('');
            setAllUnidades(false);
            setSelectedUnits([]);
            await loadData();
        } catch (err) {
            setError(err.message || 'No se pudo crear el usuario.');
        } finally {
            setCreating(false);
        }
    }

    const supervisorScopeChosen = zona || allUnidades;
    const canSubmit = role === 'agente' ? selectedUnits.length > 0 : supervisorScopeChosen || selectedUnits.length > 0;

    async function handleDelete(u) {
        if (!confirm(`Eliminar al usuario "${u}"?`)) return;
        try {
            const res = await fetch(`/api/users?username=${encodeURIComponent(u)}`, {
                method: 'DELETE',
                headers: { 'x-admin-key': adminKey }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await loadData();
        } catch (err) {
            setError(err.message || 'No se pudo eliminar el usuario.');
        }
    }

    return (
        <div>
            {error && (
                <p className="mb-4 text-red-700 bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-200 rounded px-4 py-3">
                    {error}
                </p>
            )}

            <h3 className="font-semibold text-lg mb-3">Crear usuario (supervisor o agente)</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 mb-8 max-w-lg">
                <div className="flex gap-3">
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Usuario</span>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Nombre</span>
                        <input
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                        />
                    </label>
                </div>
                <div className="flex gap-3">
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Contrasena</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Rol</span>
                        <select
                            value={role}
                            onChange={(e) => {
                                setRole(e.target.value);
                                setSelectedUnits([]);
                            }}
                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                        >
                            <option value="agente">Agente (ve solo su unidad)</option>
                            <option value="supervisor">Supervisor (ve varias unidades)</option>
                        </select>
                    </label>
                </div>

                {role === 'supervisor' && (
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Zona de responsabilidad</span>
                        <div className="flex gap-2">
                            <select
                                value={zona}
                                onChange={(e) => (e.target.value ? pickZona(e.target.value) : setZona(''))}
                                className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2 flex-1"
                            >
                                <option value="">Escoge una zona...</option>
                                {zonas.map((z) => (
                                    <option key={z.key} value={z.nombre}>
                                        {z.nombre} {z.responsable ? `— ${z.responsable}` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={pickAllUnidades}
                                className={`border rounded px-3 py-2 text-sm whitespace-nowrap ${
                                    allUnidades
                                        ? 'bg-slate-800 text-white border-slate-800'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                            >
                                Todas las unidades
                            </button>
                        </div>
                        {supervisorScopeChosen && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {allUnidades
                                    ? 'Vera todas las unidades de todas las zonas, incluidas las que se suban en el futuro.'
                                    : `Vera todas las unidades de "${zona}", incluidas las que se suban en el futuro para esa zona.`}
                            </p>
                        )}
                    </label>
                )}

                {(role === 'agente' || !supervisorScopeChosen) && (
                    <div>
                        <span className="text-sm font-medium block mb-1">
                            {role === 'agente' ? 'Unidad asignada' : 'O escoge unidades especificas'}
                        </span>
                        <div className="border border-gray-300 dark:border-gray-600 rounded max-h-48 overflow-y-auto p-2">
                            {units.map((u) => (
                                <label key={u.key} className="flex items-center gap-2 text-sm py-1">
                                    <input
                                        type={role === 'agente' ? 'radio' : 'checkbox'}
                                        name="unidad"
                                        checked={selectedUnits.includes(u.key)}
                                        onChange={() => toggleUnit(u.key)}
                                    />
                                    {u.unidad} — {u.cliente} <span className="text-gray-400 dark:text-gray-500">({u.zona})</span>
                                </label>
                            ))}
                            {units.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Sube un horario primero para poder asignar unidades.</p>
                            )}
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={creating || !canSubmit}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
                >
                    {creating ? 'Creando...' : 'Crear usuario'}
                </button>
            </form>

            <h3 className="font-semibold text-lg mb-3">Usuarios existentes</h3>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded">
                <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                            <th className="px-4 py-2">Usuario</th>
                            <th className="px-4 py-2">Nombre</th>
                            <th className="px-4 py-2">Rol</th>
                            <th className="px-4 py-2">Zona</th>
                            <th className="px-4 py-2">Unidades</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.username} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-4 py-2">{u.username}</td>
                                <td className="px-4 py-2">{u.nombre}</td>
                                <td className="px-4 py-2 capitalize">{u.role}</td>
                                <td className="px-4 py-2">{u.zona || '—'}</td>
                                <td className="px-4 py-2">
                                    {u.allUnidades ? 'Todas' : u.zona ? `Todas las de ${u.zona}` : u.unidades.join(', ')}
                                </td>
                                <td className="px-4 py-2">
                                    <button onClick={() => handleDelete(u.username)} className="text-red-600 dark:text-red-400 hover:underline">
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FirstRunSetup({ onConfigured, theme, toggleTheme }) {
    const [newKey, setNewKey] = useState('');
    const [confirmKey, setConfirmKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (newKey !== confirmKey) {
            setError('Las claves no coinciden.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newKey })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No se pudo configurar la clave.');
                return;
            }
            onConfigured(newKey);
        } catch {
            setError('No se pudo conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="max-w-md mx-auto px-4 py-16">
            <div className="flex justify-end mb-4">
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Configura tu clave de administrador</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Es la primera vez que se usa este panel. Define aqui la clave que usaras para subir horarios y crear
                usuarios — no necesitas configurar nada en Netlify.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Nueva clave (minimo 6 caracteres)"
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-4 py-2"
                    required
                    minLength={6}
                />
                <input
                    type="password"
                    value={confirmKey}
                    onChange={(e) => setConfirmKey(e.target.value)}
                    placeholder="Confirma la clave"
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-4 py-2"
                    required
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
                >
                    {loading ? 'Guardando...' : 'Guardar y entrar'}
                </button>
            </form>
            {error && (
                <p className="mt-4 text-red-700 bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-200 rounded px-4 py-3">
                    {error}
                </p>
            )}
        </main>
    );
}

function SecurityPanel({ adminKey, onKeyChanged }) {
    const [currentKey, setCurrentKey] = useState('');
    const [newKey, setNewKey] = useState('');
    const [confirmKey, setConfirmKey] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        if (newKey !== confirmKey) {
            setStatus('error');
            setMessage('Las claves nuevas no coinciden.');
            return;
        }
        setStatus('loading');
        setMessage('');
        try {
            const res = await fetch('/api/admin/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentKey, newKey })
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus('error');
                setMessage(data.error || 'No se pudo cambiar la clave.');
                return;
            }
            setStatus('success');
            setMessage('Clave actualizada correctamente.');
            setCurrentKey('');
            setNewKey('');
            setConfirmKey('');
            onKeyChanged(newKey);
        } catch {
            setStatus('error');
            setMessage('No se pudo conectar con el servidor.');
        }
    }

    return (
        <div className="max-w-md">
            <h3 className="font-semibold text-lg mb-3">Cambiar clave de administrador</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                    type="password"
                    value={currentKey}
                    onChange={(e) => setCurrentKey(e.target.value)}
                    placeholder="Clave actual"
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                    required
                />
                <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Nueva clave"
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                    required
                    minLength={6}
                />
                <input
                    type="password"
                    value={confirmKey}
                    onChange={(e) => setConfirmKey(e.target.value)}
                    placeholder="Confirma la nueva clave"
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2"
                    required
                />
                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
                >
                    {status === 'loading' ? 'Guardando...' : 'Cambiar clave'}
                </button>
            </form>
            {message && (
                <p
                    className={`mt-4 rounded px-4 py-3 border ${
                        status === 'success'
                            ? 'text-green-800 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
                            : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
                    }`}
                >
                    {message}
                </p>
            )}
        </div>
    );
}

export default function HorariosAdminPage() {
    const { theme, toggleTheme } = useTheme();
    const [adminStatus, setAdminStatus] = useState(undefined); // undefined = loading
    const [adminKey, setAdminKey] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [tab, setTab] = useState('upload');

    useEffect(() => {
        fetch('/api/admin/status')
            .then((res) => res.json())
            .then(setAdminStatus)
            .catch(() => setAdminStatus({ configured: true, envManaged: false }));
    }, []);

    function handleLock() {
        // Only clears this browser tab's local "unlocked" state and typed key — nothing
        // server-side is touched, so uploaded schedules/users are untouched. Lets someone
        // else use this same browser to log in as a different admin/agente/supervisor.
        setUnlocked(false);
        setAdminKey('');
    }

    if (adminStatus === undefined) {
        return null;
    }

    if (!adminStatus.configured) {
        return (
            <>
                <Head>
                    <title>Administrar Horarios</title>
                    <meta name="robots" content="noindex, nofollow" />
                </Head>
                <div className="min-h-screen dark:bg-gray-900 dark:text-gray-100">
                    <FirstRunSetup
                        theme={theme}
                        toggleTheme={toggleTheme}
                        onConfigured={(key) => {
                            setAdminKey(key);
                            setAdminStatus({ configured: true, envManaged: false });
                            setUnlocked(true);
                        }}
                    />
                </div>
            </>
        );
    }

    if (!unlocked) {
        return (
            <>
                <Head>
                    <title>Administrar Horarios</title>
                    <meta name="robots" content="noindex, nofollow" />
                </Head>
                <div className="min-h-screen dark:bg-gray-900 dark:text-gray-100">
                    <main className="max-w-md mx-auto px-4 py-16">
                        <div className="flex justify-end mb-4">
                            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                        </div>
                        <h1 className="text-2xl font-bold mb-6">Acceso de administrador</h1>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                setUnlocked(true);
                            }}
                            className="flex flex-col gap-4"
                        >
                            <input
                                type="password"
                                value={adminKey}
                                onChange={(e) => setAdminKey(e.target.value)}
                                placeholder="Clave de administrador"
                                className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-4 py-2"
                                required
                            />
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 self-start">
                                Entrar
                            </button>
                        </form>
                    </main>
                </div>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>Administrar Horarios</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <div className="min-h-screen dark:bg-gray-900 dark:text-gray-100">
                <main className="max-w-4xl mx-auto px-4 py-8">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold">Administrar Horarios</h1>
                        <div className="flex gap-2">
                            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                            <button
                                onClick={handleLock}
                                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                Cerrar sesion
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setTab('upload')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                tab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            Subir horario
                        </button>
                        <button
                            onClick={() => setTab('users')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            Gestionar usuarios
                        </button>
                        {!adminStatus.envManaged && (
                            <button
                                onClick={() => setTab('security')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                    tab === 'security' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Seguridad
                            </button>
                        )}
                    </div>
                    {tab === 'upload' && <UploadPanel adminKey={adminKey} />}
                    {tab === 'users' && <UsersPanel adminKey={adminKey} />}
                    {tab === 'security' && <SecurityPanel adminKey={adminKey} onKeyChanged={setAdminKey} />}
                </main>
            </div>
        </>
    );
}
