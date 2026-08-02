import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useTheme } from '../../utils/use-theme';

const TURNO_COLORS = {
    N: 'bg-slate-700 text-white dark:bg-slate-600',
    D: 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
    F: 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200',
    V: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
};

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

function ScheduleTable({ block }) {
    return (
        <div className="mb-8">
            <h3 className="font-semibold text-lg mb-1">{block.servicio}</h3>
            {block.ubicacion && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{block.ubicacion}</p>}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded">
                <table className="text-sm text-center border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                            <th className="px-3 py-2 text-left sticky left-0 bg-gray-100 dark:bg-gray-800">Colaborador</th>
                            {block.dias.map((d, i) => (
                                <th key={i} className="px-2 py-1 min-w-[36px]">
                                    <div>{d.letra}</div>
                                    <div className="text-gray-500 dark:text-gray-400">{d.dia}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.empleados.map((emp) => (
                            <tr key={emp.orden} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-3 py-2 text-left whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900">{emp.nombre}</td>
                                {emp.turnos.map((t, i) => (
                                    <td key={i} className={`px-2 py-1 ${TURNO_COLORS[t] || ''}`}>
                                        {t}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function UnitSchedule({ schedule }) {
    const meses = Object.keys(schedule.meses);
    const [mes, setMes] = useState(meses[0]);

    return (
        <div>
            <div className="mb-4">
                <h2 className="text-xl font-semibold">
                    {schedule.unidad} — {schedule.cliente}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {schedule.zona} · {schedule.ciudad}
                    {schedule.responsable && ` · Responsable: ${schedule.responsable}`}
                </p>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
                {meses.map((m) => (
                    <button
                        key={m}
                        onClick={() => setMes(m)}
                        className={`px-3 py-1 rounded text-sm border ${
                            m === mes
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'
                        }`}
                    >
                        {m}
                    </button>
                ))}
            </div>
            {schedule.meses[mes].map((block, i) => (
                <ScheduleTable key={i} block={block} />
            ))}
        </div>
    );
}

function LoginForm({ onLogin, theme, toggleTheme }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No se pudo iniciar sesion.');
                return;
            }
            onLogin(data);
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
            <h1 className="text-3xl font-bold mb-2">Consulta de Horarios</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Ingresa tus credenciales para ver el horario de tu unidad.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Usuario</span>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-4 py-2"
                        required
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Contrasena</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-4 py-2"
                        required
                    />
                </label>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Ingresando...' : 'Ingresar'}
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

export default function HorariosPage() {
    const { theme, toggleTheme } = useTheme();
    const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
    const [schedules, setSchedules] = useState(null);
    const [selectedKey, setSelectedKey] = useState(null);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setSession(data))
            .catch(() => setSession(null));
    }, []);

    useEffect(() => {
        if (!session) return;
        fetch('/api/schedules/mine')
            .then((res) => res.json())
            .then((data) => {
                if (data.schedules) {
                    setSchedules(data.schedules);
                    setSelectedKey(data.schedules[0]?.key || null);
                } else {
                    setLoadError(data.error || 'No se pudieron cargar los horarios.');
                }
            })
            .catch(() => setLoadError('No se pudo conectar con el servidor.'));
    }, [session]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        setSession(null);
        setSchedules(null);
        setSelectedKey(null);
    }

    if (session === undefined) {
        return null;
    }

    if (!session) {
        return (
            <>
                <Head>
                    <title>Consulta de Horarios</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                </Head>
                <div className="min-h-screen dark:bg-gray-900 dark:text-gray-100">
                    <LoginForm onLogin={setSession} theme={theme} toggleTheme={toggleTheme} />
                </div>
            </>
        );
    }

    const selected = schedules?.find((s) => s.key === selectedKey);

    return (
        <>
            <Head>
                <title>Consulta de Horarios</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <div className="min-h-screen dark:bg-gray-900 dark:text-gray-100">
                <main className="max-w-5xl mx-auto px-4 py-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold">Hola, {session.nombre}</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{session.role}</p>
                        </div>
                        <div className="flex gap-2">
                            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                            <button
                                onClick={handleLogout}
                                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                Cerrar sesion
                            </button>
                        </div>
                    </div>

                    {loadError && (
                        <p className="text-red-700 bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-200 rounded px-4 py-3 mb-6">
                            {loadError}
                        </p>
                    )}

                    {schedules && schedules.length > 1 && (
                        <div className="flex gap-2 mb-6 flex-wrap">
                            {schedules.map((s) => (
                                <button
                                    key={s.key}
                                    onClick={() => setSelectedKey(s.key)}
                                    className={`px-3 py-1.5 rounded text-sm border ${
                                        s.key === selectedKey
                                            ? 'bg-slate-800 text-white border-slate-800'
                                            : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'
                                    }`}
                                >
                                    {s.unidad}
                                </button>
                            ))}
                        </div>
                    )}

                    {schedules && schedules.length === 0 && (
                        <p className="text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200 rounded px-4 py-3">
                            Todavia no hay un horario cargado para tu unidad asignada.
                        </p>
                )}

                    {selected && <UnitSchedule schedule={selected} />}
                </main>
            </div>
        </>
    );
}
