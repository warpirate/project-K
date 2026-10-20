export interface Searchable {
  id: string;
  name: string;
  aliases: string[];
}

export const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Name/alias substring match; names starting with the query rank first, then alphabetical. */
export function searchServices<T extends Searchable>(list: T[], query: string): T[] {
  const q = normalizeName(query);
  if (!q) return [...list].sort((a, b) => a.name.localeCompare(b.name));
  const scored = list
    .map((s) => {
      const name = normalizeName(s.name);
      const aliases = s.aliases.map(normalizeName);
      const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : aliases.some((a) => a.includes(q)) ? 2 : -1;
      return { s, score };
    })
    .filter((x) => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name));
  return scored.map((x) => x.s);
}

export function findExact<T extends Searchable>(list: T[], name: string): T | undefined {
  const n = normalizeName(name);
  return list.find((s) => normalizeName(s.name) === n);
}
