import { readFileSync } from 'node:fs';
import { chapterData } from './chapter-data.mjs';
import { buildRoster } from './hero-roster.mjs';

const source = new URL('../../地图解析/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, source), 'utf8'));
const xy = ([x, y]) => ({ x, y });

export function loadScenario() {
  const game = read('玩法与波次.json');
  const terrain = read('地图数据/地形.json');
  const info = read('地图数据/地图信息.json');
  const pathing = read('地图数据/寻路网格.json');
  const objects = read('物件数据.json');
  const units = read('地图数据/单位与起点摆放.json').placements;
  const deco = read('地图数据/装饰物与可破坏物.json').placements;
  const firstWave = game.进攻.兵种表[0];
  const chapter = chapterData(game,objects);
  const roster=buildRoster(game,objects,chapter.skills);
  const shops = game.有显式销售清单的预放商店及佣兵营.map(s => ({
    id: s.单位ID, name: s.地图改名 || (s.单位ID === 'n007' ? '佣兵营地' : '武器商店'), ...xy(s.坐标),
  }));
  const placements = units.map(p => ({
    id: p.id, ...xy(p.xyz), angle: p.angleRadians, owner: p.ownerSlot, ownerSlot: p.ownerSlot,
  }));
  const stats = {};
  const used = new Set(['nftr','Hpal','Hamg','Hblm','Hmkg','nitb','ewsp','pghe','ankh','AHhb','Atau','AIh1','AIrc']);
  for (const w of chapter.waves) used.add(w.type);
  for (const hero of roster) used.add(hero.id);
  for (const id of ['hwat','hwt2','hwt3','h00N']) used.add(id);
  for (const group of Object.values(objects)) {
    for (const entry of [...group.原生覆盖, ...group.新增对象]) {
      if (!used.has(entry.id)) continue;
      const fields = {};
      for (const mod of entry.modifications) {
        if (mod.level > 1) continue;
        fields[mod.field] = mod.value;
      }
      stats[entry.id] = fields;
    }
  }
  const [left, , bottom] = info.cameraMargins;
  const [width, height] = info.playableSize;
  const step = terrain.worldUnitsPerTile;
  const minX = terrain.originXY[0] + left * step;
  const minY = terrain.originXY[1] + bottom * step;
  return {
    ...chapter,roster,attackPerPrimary:Number(game.全局游戏常量覆盖.StrAttackBonus),
    bounds: { minX, minY, maxX: minX + width * step, maxY: minY + height * step },
    terrain, pathing: { rows: pathing.rows, width: pathing.width, height: pathing.height, cell: pathing.worldUnitsPerCell },
    doodads: deco.map(p => ({ id: p.id, ...xy(p.xyz), angle: p.angleRadians, scale: p.scale[0], variation: p.variation })),
    placements, stats, shops, shop: shops.find(s => s.id === 'n002'),
    alliedPlacements: placements.filter(p => p.owner === 8 && ['Hpal','Hamg','Hblm','Hmkg'].includes(p.id)),
    statue: xy(game.神像.坐标),
    wispSpawn: placements.find(p => p.owner === 0 && p.id === 'ewsp'),
    heroSpawn: xy(game.选人.英雄出生区域.中心坐标),
    altar: xy(game.选人.英雄列表.find(h => h.单位ID === 'Hpal').选择区.中心坐标),
    lanes: game.进攻.出怪区域.map(r => xy(r.中心坐标)),
    wave: { type: firstWave.兵种ID, perLane: firstWave.每路数量, startsAt: game.开局.首波预计出现于开局后秒 },
  };
}
