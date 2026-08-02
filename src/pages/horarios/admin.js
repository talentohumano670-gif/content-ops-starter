import React, { useEffect, useState } from 'react';
import Head from 'next/head';

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function UploadPanel({ adminKey }) {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [summary, setSummary] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
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
                body: JSON.stringify({ adminKey, fileBase64 })
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
            <p className="text-gray-600 mb-6">
                Sube el archivo Excel &quot;Horario Detallado de Unidades&quot; (una hoja por mes). El sistema detecta
                automaticamente cada unidad (Nominativo) por cliente, con sus turnos diarios.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="border border-gray-300 rounded px-4 py-2"
                    required
                />
                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
                >
                    {status === 'loading' ? 'Subiendo...' : 'Subir horarios'}
                </button>
            </form>

            {status === 'error' && (
                <p className="mt-6 text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">{message}</p>
            )}

            {status === 'success' && summary && (
                <div className="mt-6 text-green-800 bg-green-50 border border-green-200 rounded px-4 py-3">
                    <p className="font-medium mb-2">{summary.totalUnidades} unidad(es) actualizada(s) correctamente.</p>
                    <ul className="list-disc list-inside text-sm max-h-64 overflow-y-auto">
                        {summary.unidades.map((u) => (
                            <li key={u.key}>
                                {u.unidad} — {u.cliente}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function UsersPanel({ adminKey }) {
    const [units, setUnits] = useState([]);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');

    const [username, setUsername] = useState('');
    const [nombre, setNombre] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('agente');
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [creating, setCreating] = useState(false);

    async function loadData() {
        setError('');
        try {
            const [unitsRes, usersRes] = await Promise.all([
                fetch('/api/schedules/units', { headers: { 'x-admin-key': adminKey } }),
                fetch('/api/users', { headers: { 'x-admin-key': adminKey } })
            ]);
            const unitsData = await unitsRes.json();
            const usersData = await usersRes.json();
            if (!unitsRes.ok) throw new Error(unitsData.error);
            if (!usersRes.ok) throw new Error(usersData.error);
            setUnits(unitsData.units);
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
        setSelectedUnits((prev) => {
            if (role === 'agente') return prev.includes(key) ? [] : [key];
            return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        });
    }

    async function handleCreate(e) {
        e.preventDefault();
        setCreating(true);
        setError('');
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
                body: JSON.stringify({ username, password, nombre, role, unidades: selectedUnits })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setUsername('');
            setNombre('');
            setPassword('');
            setSelectedUnits([]);
            await loadData();
        } catch (err) {
            setError(err.message || 'No se pudo crear el usuario.');
        } finally {
            setCreating(false);
        }
    }

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
            {error && <p className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>}

            <h3 className="font-semibold text-lg mb-3">Crear usuario (supervisor o agente)</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3 mb-8 max-w-lg">
                <div className="flex gap-3">
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Usuario</span>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2"
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Nombre</span>
                        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />
                    </label>
                </div>
                <div className="flex gap-3">
                    <label className="flex flex-col gap-1 flex-1">
                        <span className="text-sm font-medium">Contrasena</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2"
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
                            className="border border-gray-300 rounded px-3 py-2"
                        >
                            <option value="agente">Agente (ve solo su unidad)</option>
                            <option value="supervisor">Supervisor (ve varias unidades)</option>
                        </select>
                    </label>
                </div>

                <div>
                    <span className="text-sm font-medium block mb-1">
                        {role === 'agente' ? 'Unidad asignada' : 'Unidades asignadas'}
                    </span>
                    <div className="border border-gray-300 rounded max-h-48 overflow-y-auto p-2">
                        {units.map((u) => (
                            <label key={u.key} className="flex items-center gap-2 text-sm py-1">
                                <input
                                    type={role === 'agente' ? 'radio' : 'checkbox'}
                                    name="unidad"
                                    checked={selectedUnits.includes(u.key)}
                                    onChange={() => toggleUnit(u.key)}
                                />
                                {u.unidad} — {u.cliente}
                            </label>
                        ))}
                        {units.length === 0 && <p className="text-sm text-gray-500">Sube un horario primero para poder asignar unidades.</p>}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={creating || selectedUnits.length === 0}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
                >
                    {creating ? 'Creando...' : 'Crear usuario'}
                </button>
            </form>

            <h3 className="font-semibold text-lg mb-3">Usuarios existentes</h3>
            <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-2">Usuario</th>
                            <th className="px-4 py-2">Nombre</th>
                            <th className="px-4 py-2">Rol</th>
                            <th className="px-4 py-2">Unidades</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.username} className="border-t border-gray-200">
                                <td className="px-4 py-2">{u.username}</td>
                                <td className="px-4 py-2">{u.nombre}</td>
                                <td className="px-4 py-2 capitalize">{u.role}</td>
                                <td className="px-4 py-2">{u.unidades.join(', ')}</td>
                                <td className="px-4 py-2">
                                    <button onClick={() => handleDelete(u.username)} className="text-red-600 hover:underline">
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

export default function HorariosAdminPage() {
    const [adminKey, setAdminKey] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [tab, setTab] = useState('upload');

    if (!unlocked) {
        return (
            <>
                <Head>
                    <title>Administrar Horarios</title>
                    <meta name="robots" content="noindex, nofollow" />
                </Head>
                <main className="max-w-md mx-auto px-4 py-16">
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
                            className="border border-gray-300 rounded px-4 py-2"
                            required
                        />
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 self-start">
                            Entrar
                        </button>
                    </form>
                </main>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>Administrar Horarios</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <main className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6">Administrar Horarios</h1>
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setTab('upload')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                    >
                        Subir horario
                    </button>
                    <button
                        onClick={() => setTab('users')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
                    >
                        Gestionar usuarios
                    </button>
                </div>
                {tab === 'upload' ? <UploadPanel adminKey={adminKey} /> : <UsersPanel adminKey={adminKey} />}
            </main>
        </>
    );
}
