interface Occurrence {
  id: string;
  latitude: number;
  longitude: number;
  date: string;
  /** Bairro (CSV neighborhood_name) */
  neighborhood?: string;
  /** Motivo principal (CSV contextInfo_mainReason_name) */
  reason?: string;
  /** Complementos (CSV contextInfo_complementaryReasons), texto bruto */
  complementaryReasonsRaw?: string;
  /** Trecho curto do endereço */
  addressSummary?: string;
  /** Com base na coluna `transports`: ônibus, BRT, VLT ou texto relacionado */
  involvesBusTransport?: boolean;
  transportModes?: string[];
  /** Resumo do campo transportDescription */
  transportNarrative?: string;
  transportInterrupted?: boolean;
  policeAction?: boolean;
  policeUnit?: string;
  documentNumber?: string;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Analisa a célula `transports` do CSV (dict estilo Python em string). */
function parseTransportsCell(raw: string | undefined): {
  involvesBus: boolean;
  modes: string[];
  narrative: string;
  interrupted: boolean;
} {
  if (!raw?.trim()) {
    return { involvesBus: false, modes: [], narrative: '', interrupted: false };
  }
  const interrupted =
    /'interruptedTransport':\s*True/i.test(raw) || /"interruptedTransport":\s*true/i.test(raw);

  const modes: string[] = [];
  const re =
    /'transport'\s*:\s*\{\s*'id'\s*:\s*'[^']*'\s*,\s*'name'\s*:\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    modes.push(m[1]);
  }

  let narrative = '';
  const narrMatch = raw.match(/'transportDescription'\s*:\s*'((?:[^'\\]|\\.){0,4000})/);
  if (narrMatch) {
    narrative = narrMatch[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const blob = stripAccents(raw).toLowerCase();
  const modeNorm = modes.map((x) => stripAccents(x).toLowerCase());
  const busByMode = modeNorm.some(
    (x) =>
      x.includes('onibus') ||
      x === 'brt' ||
      x.includes('brt') ||
      x.includes('vlt') ||
      x.includes('micro-onibus') ||
      x.includes('micro onibus'),
  );

  const busByText =
    /\b(onibus|brt|vlt|coletivo|transbrasil|mobirio|supervia)\b/.test(blob) ||
    /linhas de onibus|linha de onibus|apedrej|coletivos|o onibus|bus da linha/.test(blob);

  const involvesBus = busByMode || busByText;

  return {
    involvesBus,
    modes: [...new Set(modes)],
    narrative,
    interrupted,
  };
}

function truncateNarrative(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function shortenAddress(raw: string): string | undefined {
  const t = raw.trim().replace(/^"|"$/g, '');
  if (!t) return undefined;
  const first = t.split(',')[0]?.trim();
  if (!first) return undefined;
  if (first.length <= 56) return first;
  return `${first.slice(0, 53)}…`;
}

/** Rótulo curto para UI (sem datas). */
export function getOccurrenceLabel(occ: Occurrence): string {
  const nb = occ.neighborhood?.trim();
  const rs = occ.reason?.trim();
  let base: string;
  if (nb && rs) base = `${nb} · ${rs}`;
  else if (nb) base = nb;
  else if (rs) base = rs;
  else if (occ.addressSummary?.trim()) base = occ.addressSummary.trim();
  else base = 'Registro no trajeto';

  return base;
}

class FogoCruzadoService {
  private occurrences: Occurrence[] | null = null;

  async getOccurrences(): Promise<Occurrence[]> {
    if (this.occurrences) {
      return this.occurrences;
    }

    try {
      console.log('📥 Carregando CSV do Fogo Cruzado...');
      const response = await fetch('/fogocruzado.csv');
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.statusText}`);
      }

      const csvText = await response.text();
      console.log('📄 CSV carregado, tamanho:', csvText.length, 'caracteres');

      this.occurrences = this.parseCSV(csvText);
      console.log('✅ CSV parseado, ocorrências encontradas:', this.occurrences.length);

      return this.occurrences;
    } catch (error) {
      console.error('❌ Error loading Fogo Cruzado CSV:', error);
      return [];
    }
  }

  /** Split one CSV row respecting double-quoted fields (commas/newlines inside quotes). */
  private parseCSVRow(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  }

  private parseCSV(csvText: string): Occurrence[] {
    const rows: string[] = [];
    let row = '';
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
      const c = csvText[i];
      if (inQuotes) {
        row += c;
        if (c === '"' && csvText[i + 1] === '"') {
          row += csvText[++i];
        } else if (c === '"') {
          inQuotes = false;
        }
      } else if (c === '"') {
        row += c;
        inQuotes = true;
      } else if (c === '\n' || (c === '\r' && csvText[i + 1] === '\n')) {
        if (c === '\r') i++;
        if (row.trim()) rows.push(row);
        row = '';
      } else {
        row += c;
      }
    }
    if (row.trim()) rows.push(row);

    if (rows.length < 2) return [];

    const headers = this.parseCSVRow(rows[0]).map((h) => h.trim().toLowerCase());
    const latIdx = headers.indexOf('latitude');
    const lngIdx = headers.indexOf('longitude');
    const dateIdx = headers.indexOf('date');
    const idIdx = headers.indexOf('id');
    const neighborhoodIdx = headers.indexOf('neighborhood_name');
    const reasonIdx = headers.indexOf('contextinfo_mainreason_name');
    const complementaryIdx = headers.indexOf('contextinfo_complementaryreasons');
    const addressIdx = headers.indexOf('address');
    const transportsIdx = headers.indexOf('transports');
    const policeActionIdx = headers.indexOf('policeaction');
    const policeUnitIdx = headers.indexOf('contextinfo_policeunit');
    const documentNumberIdx = headers.indexOf('documentnumber');
    if (latIdx < 0 || lngIdx < 0 || dateIdx < 0) return [];

    const occurrences: Occurrence[] = [];

    for (let i = 1; i < rows.length; i++) {
      const values = this.parseCSVRow(rows[i]);
      if (values.length < headers.length) continue;

      const rawLat = values[latIdx]?.replace(/\s+/g, '') ?? '';
      const rawLng = values[lngIdx]?.replace(/\s+/g, '') ?? '';
      const lat = parseFloat(rawLat);
      const lng = parseFloat(rawLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const rawDate = values[dateIdx] ?? '';
      let dateStr = rawDate;
      try {
        const d = new Date(rawDate);
        if (!Number.isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
      } catch {
        /* keep raw */
      }
      if (!dateStr) continue;

      const id = idIdx >= 0 ? values[idIdx] : String(i);
      const neighborhood =
        neighborhoodIdx >= 0 ? (values[neighborhoodIdx]?.trim() || undefined) : undefined;
      const reason = reasonIdx >= 0 ? (values[reasonIdx]?.trim() || undefined) : undefined;
      const complementaryReasonsRaw =
        complementaryIdx >= 0 ? (values[complementaryIdx]?.trim() || undefined) : undefined;
      const addressSummary =
        addressIdx >= 0 ? shortenAddress(values[addressIdx] ?? '') : undefined;

      const transportsRaw = transportsIdx >= 0 ? values[transportsIdx] : undefined;
      const tx = parseTransportsCell(transportsRaw);

      let involvesBus = tx.involvesBus;
      const addrNorm = stripAccents(`${addressSummary ?? ''} ${neighborhood ?? ''}`).toLowerCase();
      if (!involvesBus && /\b(brt|onibus|coletivo|terminal brt|transbrasil)\b/.test(addrNorm)) {
        involvesBus = true;
      }

      const policeRaw = policeActionIdx >= 0 ? values[policeActionIdx]?.trim().toLowerCase() : '';
      const policeAction = policeRaw === 'true';

      const policeUnit =
        policeUnitIdx >= 0 ? (values[policeUnitIdx]?.trim() || undefined) : undefined;

      const documentNumber =
        documentNumberIdx >= 0 ? (values[documentNumberIdx]?.trim() || undefined) : undefined;

      occurrences.push({
        id,
        latitude: lat,
        longitude: lng,
        date: dateStr,
        neighborhood,
        reason,
        complementaryReasonsRaw,
        addressSummary,
        involvesBusTransport: involvesBus,
        transportModes: tx.modes.length > 0 ? tx.modes : undefined,
        transportNarrative: tx.narrative ? truncateNarrative(tx.narrative, 320) : undefined,
        transportInterrupted: tx.interrupted || undefined,
        policeAction: policeAction || undefined,
        policeUnit,
        documentNumber,
      });
    }

    return occurrences;
  }

  // Método para filtrar ocorrências por data (últimas 24 horas)
  getRecentOccurrences(occurrences: Occurrence[]): Occurrence[] {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return occurrences.filter(occ => {
      // A data no CSV já está no formato YYYY-MM-DD
      return occ.date >= yesterdayStr;
    });
  }

  // Método para filtrar por estado (Rio de Janeiro)
  getOccurrencesInRio(occurrences: Occurrence[]): Occurrence[] {
    // Se o CSV já filtra por RJ, pode retornar tudo
    // Caso contrário, adicione lógica de filtro aqui
    return occurrences;
  }
}

export const fogoCruzadoService = new FogoCruzadoService();
export type { Occurrence };