/* Stage 2d: runes. The client's rune lists (perkstyles.json, perks.json) give the trees, their rows,
   names and descriptions; the game file (perks.cdtb.bin.json) gives each rune's numbers, as named
   values and calculations in the same format as a spell's. Per-mode values are ignored: Summoner's Rift only. */
import type { CalcData, RuneKind, RuneSet, RuneStyle } from '../shared/types.ts';
import { clean, compileCalcs, type CompileLog } from './calc.ts';

type Raw = Record<string, any>;

export interface CompiledRune {
  id: number;
  name: string;
  /** the game's name for it, e.g. PressTheAttack */
  key: string;
  /** the tree it is picked from; 0 for stat shards */
  style: number;
  kind: RuneKind;
  icon: string;
  desc: string;
  dataValues: Record<string, number>;
  calcs: Record<string, CalcData>;
}

const KIND: Record<string, RuneKind> = { kKeyStone: 'keystone', kMixedRegularSplashable: 'minor', kStatMod: 'shard' };

/** Client text to plain text: line breaks kept, markup dropped. */
export const plain = (html: string) => html
  .replace(/<br\s*\/?>/gi, '\n').replace(/<hr\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

export function compileRunes(bin: Raw, perks: Raw[], styles: Raw, log: CompileLog): { set: Omit<RuneSet, 'runes'>; runes: CompiledRune[] } {
  const game = new Map<number, Raw>();
  for (const v of Object.values(bin)) if (v?.__type === 'Perk' && typeof v.mPerkId === 'number') game.set(v.mPerkId, v);
  const client = new Map(perks.map(p => [p.id as number, p]));

  const out: RuneStyle[] = [];
  let shards: number[][] = [];
  const styleOf = new Map<number, { style: number; kind: RuneKind }>();
  for (const s of styles.styles ?? []) {
    const rows: RuneStyle['rows'] = [];
    for (const slot of s.slots ?? []) {
      const kind = KIND[slot.type];
      if (!kind) continue;
      if (kind === 'shard') continue;
      rows.push({ kind, perks: slot.perks });
      for (const id of slot.perks) styleOf.set(id, { style: s.id, kind });
    }
    // every tree offers the same three rows of stat shards; they are kept once
    const shardRows = (s.slots ?? []).filter((x: Raw) => KIND[x.type] === 'shard').map((x: Raw) => x.perks as number[]);
    if (shardRows.length) shards = shardRows;
    out.push({ id: s.id, name: s.name, rows });
  }
  for (const row of shards) for (const id of row) if (!styleOf.has(id)) styleOf.set(id, { style: 0, kind: 'shard' });

  const runes: CompiledRune[] = [];
  for (const [id, where] of styleOf) {
    const c = client.get(id), g = game.get(id);
    if (!c) continue;
    const data: Raw = g?.mScript?.mSpellScriptData ?? {};
    const dataValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.mEffectAmount ?? {})) if (typeof v === 'number') dataValues[k] = clean(v);
    runes.push({
      id, name: c.name, key: g?.mPerkName ?? c.name.replace(/\W/g, ''), style: where.style, kind: where.kind,
      icon: String(c.iconPath ?? '').split('/').pop() ?? '',
      desc: plain(String(c.longDesc ?? c.shortDesc ?? '')),
      dataValues, calcs: compileCalcs(data.mCalculations, log),
    });
  }
  runes.sort((a, b) => a.id - b.id);
  return { set: { styles: out, shards }, runes };
}
