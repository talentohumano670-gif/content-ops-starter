import * as XLSX from 'xlsx';
import { normalizeKey } from './schedule-store';

const DAY_ABBR = new Set(['lu', 'ma', 'mi', 'ju', 'vi', 'sa', 'do']);

function isRowBlank(row) {
    return row.every((c) => String(c ?? '').trim() === '');
}

function normalizeLabel(cell) {
    if (typeof cell !== 'string') return '';
    return normalizeKey(cell.replace(/:$/, ''));
}

/**
 * Report rows are label:value pairs with arbitrary gaps ("Nominativo:", "", "TANGO 27", ...,
 * "Ciudad:", "", "Guayaquil"), so a label's value is just the next non-empty cell after it.
 */
function findLabelValue(row, labelKey) {
    for (let i = 0; i < row.length; i++) {
        if (normalizeLabel(row[i]) === labelKey) {
            for (let j = i + 1; j < row.length; j++) {
                const v = String(row[j] ?? '').trim();
                if (v !== '') return v;
            }
            return '';
        }
    }
    return undefined;
}

function isOrderNumber(value) {
    if (typeof value === 'number') return true;
    return typeof value === 'string' && /^\d+$/.test(value.trim());
}

/**
 * Parses a "Horario Detallado de Unidades" workbook (one sheet per month). Each sheet is a
 * free-form report, not a table: a client section ("Cliente:"/"Provincia:"/"Zona:") can contain
 * several posts/units ("Nominativo:"), and each unit can have several shift groups ("Servicio:"),
 * each with its own day-of-month header row followed by one row per guard.
 *
 * Units (Nominativo codes, e.g. "TANGO 27") are the access-control boundary: an "agente" is
 * assigned to exactly one unit, a "supervisor" to several, and only ever sees those.
 */
export function parseScheduleWorkbook(bytesOrArrayBuffer) {
    const workbook = XLSX.read(bytesOrArrayBuffer, { type: 'array' });
    const units = new Map();

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        parseSheetIntoUnits(rows, sheetName, units);
    }

    return units;
}

function parseSheetIntoUnits(rows, mesName, units) {
    let clienteCtx = null; // { cliente, provincia, zona }
    let currentUnit = null; // { nominativo, ciudad, cliente, provincia, zona }
    let servicioBlocks = null;

    const flushUnit = () => {
        if (!currentUnit || !currentUnit.nominativo || !servicioBlocks || servicioBlocks.length === 0) return;
        const key = normalizeKey(currentUnit.nominativo);
        if (!units.has(key)) {
            units.set(key, {
                unidad: currentUnit.nominativo,
                cliente: currentUnit.cliente,
                provincia: currentUnit.provincia,
                zona: currentUnit.zona,
                ciudad: currentUnit.ciudad,
                meses: {}
            });
        }
        const unit = units.get(key);
        unit.cliente = currentUnit.cliente || unit.cliente;
        unit.ciudad = currentUnit.ciudad || unit.ciudad;
        unit.meses[mesName] = servicioBlocks;
    };

    let i = 0;
    while (i < rows.length) {
        const row = rows[i];
        if (isRowBlank(row)) {
            i++;
            continue;
        }

        const clienteVal = findLabelValue(row, 'cliente');
        if (clienteVal !== undefined) {
            flushUnit();
            clienteCtx = { cliente: clienteVal, provincia: '', zona: '' };
            currentUnit = null;
            servicioBlocks = null;
            i++;
            continue;
        }

        if (!clienteCtx) {
            i++;
            continue; // preamble rows before the first "Cliente:" block
        }

        const provinciaVal = findLabelValue(row, 'provincia');
        if (provinciaVal !== undefined) {
            clienteCtx.provincia = provinciaVal;
            i++;
            continue;
        }

        const zonaVal = findLabelValue(row, 'zona');
        if (zonaVal !== undefined) {
            clienteCtx.zona = zonaVal;
            i++;
            continue;
        }

        const nominativoVal = findLabelValue(row, 'nominativo');
        if (nominativoVal !== undefined) {
            flushUnit();
            currentUnit = { nominativo: nominativoVal, ciudad: findLabelValue(row, 'ciudad') || '', ...clienteCtx };
            servicioBlocks = [];
            i++;
            continue;
        }

        const servicioVal = findLabelValue(row, 'servicio');
        if (servicioVal !== undefined && currentUnit) {
            const block = { servicio: servicioVal, ubicacion: findLabelValue(row, 'ubicacion') || '', dias: [], empleados: [] };
            servicioBlocks.push(block);
            i++;

            if (i >= rows.length) break;
            const dayNameRow = rows[i];
            const startCol = dayNameRow.findIndex((c) => DAY_ABBR.has(normalizeKey(String(c))));
            if (startCol === -1) continue; // not the expected layout, let the outer loop reprocess this row

            const letras = [];
            for (let c = startCol; c < dayNameRow.length; c++) {
                const v = String(dayNameRow[c] ?? '').trim();
                if (!v) break;
                letras.push(v.toUpperCase());
            }
            i++;

            if (i >= rows.length) break;
            const dayNumRow = rows[i];
            const numeros = letras.map((_, idx) => {
                const v = dayNumRow[startCol + idx];
                return v === '' || v === undefined ? null : Number(v);
            });
            block.dias = letras.map((letra, idx) => ({ dia: numeros[idx], letra }));
            i++;

            while (i < rows.length) {
                const empRow = rows[i];
                const orden = empRow[0];
                const nombre = empRow[1];
                if (!isOrderNumber(orden) || !String(nombre ?? '').trim()) break;
                const turnos = letras.map((_, idx) => String(empRow[startCol + idx] ?? '').trim());
                block.empleados.push({ orden: Number(orden), nombre: String(nombre).trim(), turnos });
                i++;
            }
            continue;
        }

        i++;
    }

    flushUnit();
}
