import type { Occurrence } from './fogocruzado';

export type RouteSafetyLevel = 'good' | 'caution' | 'bad';

/** Resumo em linguagem simples, sem números “técnicos”. */
export type RouteSafetyLayman = {
  level: RouteSafetyLevel;
  headline: string;
  tone: 'good' | 'caution' | 'bad';
};

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function crimeSearchBlob(occ: Occurrence): string {
  return [occ.reason, occ.complementaryReasonsRaw, occ.addressSummary].filter(Boolean).join(' ');
}

/**
 * Somente: roubo, assalto, furto, tentativa (ligada a roubo/furto/assalto), arrastão,
 * latrocínio, invasão. Texto já normalizado (sem acentos).
 */
const CRIME_KEYWORDS =
  /assalt|roub|furt|tentativa\/roubo|tentativa\/furto|tentativa de roubo|tentativa de furto|tentativa de assalt|arra[s]?tao|latrocin|invasao/i;

export function occurrenceIsPatrimonialCrime(occ: Occurrence): boolean {
  const blob = crimeSearchBlob(occ);
  if (!norm(blob).trim()) return false;

  const r = norm(occ.reason ?? '').trim();
  const onlyUnknownReason =
    /^(nao identificado|nao identificada)\s*$/i.test(r) &&
    !(occ.complementaryReasonsRaw && occ.complementaryReasonsRaw.trim().length > 8);
  if (onlyUnknownReason) return false;

  return CRIME_KEYWORDS.test(norm(blob));
}

export function computeRouteSafetyLayman(occurrences: Occurrence[]): RouteSafetyLayman {
  const n = occurrences.length;
  console.log('n', n);
  if (n === 0) {
    return {
      level: 'good',
      headline: 'Parece tranquilo',
      tone: 'good',
    };
  }
  if (n <= 10) {
    return {
      level: 'caution',
      headline: 'Fique alerta',
      tone: 'caution',
    };
  }
  return {
    level: 'bad',
    headline: 'Cuidado redobrado',
    tone: 'bad',
  };
}

/** Detalhes extras para o tooltip (complementos, transporte). */
export function getOccurrenceExtraContext(occ: Occurrence): string | null {
  const parts: string[] = [];
  const comp = occ.complementaryReasonsRaw?.trim();
  if (comp && comp.length > 5) {
    parts.push(comp.length > 220 ? `${comp.slice(0, 217)}…` : comp);
  }
  if (occ.transportNarrative) {
    parts.push(
      occ.transportNarrative.length > 200
        ? `${occ.transportNarrative.slice(0, 197)}…`
        : occ.transportNarrative,
    );
  } else if (occ.transportModes?.length) {
    parts.push(`Transporte: ${occ.transportModes.join(', ')}`);
  }
  if (occ.transportInterrupted) parts.push('Interrupção ou desvio de transporte');
  if (parts.length === 0) return null;
  return parts.join(' · ');
}
