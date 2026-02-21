import {
  type Ability,
  type Card,
  type CardTarget,
  type ClassTag,
  type Condition,
  type DeckCard,
  type DeckCardType,
  type Faction,
  type Keyword,
  type Race,
} from "@/lib/game/types";

function asCountText(value: number | undefined, fallback = 0): string {
  return `${value ?? fallback}`;
}

export function factionText(faction: Faction): string {
  if (faction === "HEAVEN") {
    return "สวรรค์";
  }
  if (faction === "DEMON") {
    return "ปีศาจ";
  }
  return "กลาง";
}

export function raceText(race: Race): string {
  if (race === "HUMAN") {
    return "มนุษย์";
  }
  if (race === "ANGEL") {
    return "เทวา";
  }
  if (race === "BEASTKIN") {
    return "อสูรปีก";
  }
  if (race === "MACHINE") {
    return "จักรกล";
  }
  if (race === "DRAGONKIN") {
    return "มังกร";
  }
  if (race === "DEMON") {
    return "ปีศาจ";
  }
  if (race === "UNDEAD") {
    return "อันเดด";
  }
  if (race === "ABYSSAL") {
    return "อะบิสซัล";
  }
  return "ไม่มีเผ่า";
}

export function classTagText(classTag: ClassTag): string {
  if (classTag === "WARRIOR") {
    return "นักรบ";
  }
  if (classTag === "ARCHER") {
    return "นักธนู";
  }
  if (classTag === "MAGE") {
    return "จอมเวท";
  }
  if (classTag === "PRIEST") {
    return "นักบวช";
  }
  if (classTag === "ASSASSIN") {
    return "นักลอบสังหาร";
  }
  if (classTag === "TANK") {
    return "แทงก์";
  }
  return "ซัพพอร์ต";
}

export function keywordText(keyword: Keyword): string {
  if (keyword === "TAUNT") {
    return "Taunt (บังคับตี)";
  }
  if (keyword === "RUSH") {
    return "Rush (ลงแล้วตีได้)";
  }
  if (keyword === "LIFESTEAL") {
    return "Lifesteal (ดูดเลือด)";
  }
  if (keyword === "WARD") {
    return "Ward (กันดาเมจ 1 ครั้ง)";
  }
  if (keyword === "SNIPER") {
    return "Sniper (ยิงข้ามหน้าได้)";
  }
  if (keyword === "SILENCED") {
    return "Silenced";
  }
  return "Shield";
}

export function deckCardTypeText(card: DeckCard): string {
  if (card.cardType === "UNIT") {
    return "ยูนิต";
  }
  if (card.cardType === "SPELL_GENERIC") {
    return "เวททั่วไป";
  }
  if (card.cardType === "SPELL_CLASS") {
    return "เวทอาชีพ";
  }
  if (card.cardType === "SKILL_RACE") {
    return "สกิลเผ่า";
  }
  return "สกิลฝั่ง";
}

export function cardKindText(card: Card): string {
  if (card.kind === "KING") {
    return "ราชา";
  }
  if (card.kind === "COMMANDER") {
    return "แม่ทัพ";
  }
  return deckCardTypeText(card);
}

export function cardCostText(card: Card): string {
  if (card.kind === "KING") {
    return "ไม่มีค่าร่าย";
  }
  if (card.kind === "COMMANDER") {
    return `มานา ${card.cost.mana}`;
  }
  return `มานา ${card.cost.mana} / แต้มฝั่ง ${card.cost.sideStacks}`;
}

function targetOwnerText(owner: CardTarget["owner"]): string {
  if (owner === "SELF") {
    return "ฝั่งตัวเอง";
  }
  if (owner === "ALLY") {
    return "ยูนิตฝั่งเรา";
  }
  if (owner === "ENEMY") {
    return "ฝั่งศัตรู";
  }
  if (owner === "BOTH") {
    return "ทั้งสองฝั่ง";
  }
  return "ไม่มีเป้า";
}

function targetZoneText(zone: CardTarget["zone"]): string {
  if (zone === "KING") {
    return "ราชา";
  }
  if (zone === "COMMANDER") {
    return "แม่ทัพ";
  }
  if (zone === "BOARD_FRONT") {
    return "แนวหน้า";
  }
  if (zone === "BOARD_BACK") {
    return "แนวหลัง";
  }
  if (zone === "BOARD_ANY") {
    return "ยูนิตบนกระดาน";
  }
  if (zone === "UNIT_ANY") {
    return "ยูนิตทั้งหมด";
  }
  if (zone === "HAND") {
    return "การ์ดในมือ";
  }
  if (zone === "DECK") {
    return "สำรับ";
  }
  if (zone === "DISCARD") {
    return "สุสาน";
  }
  return "ไม่ต้องเลือกเป้า";
}

function targetSelectorText(selector: CardTarget["selector"]): string {
  if (selector === "CHOSEN") {
    return "ผู้เล่นเลือกเอง";
  }
  if (selector === "RANDOM") {
    return "สุ่ม";
  }
  if (selector === "ALL") {
    return "ทั้งหมด";
  }
  if (selector === "LOWEST_HP") {
    return "เลือดน้อยสุด";
  }
  if (selector === "HIGHEST_ATK") {
    return "โจมตีสูงสุด";
  }
  if (selector === "SAME_COLUMN") {
    return "คอลัมน์เดียวกัน";
  }
  if (selector === "LEFTMOST") {
    return "ซ้ายสุด";
  }
  if (selector === "RIGHTMOST") {
    return "ขวาสุด";
  }
  if (selector === "THIS") {
    return "ตัวเอง";
  }
  return "อัตโนมัติ";
}

function conditionText(condition?: Condition): string {
  if (!condition) {
    return "";
  }
  if (condition.type === "ALLY_CLASS_COUNT_AT_LEAST") {
    return `เมื่อมี ${classTagText(condition.classTag ?? "WARRIOR")} ฝั่งเราอย่างน้อย ${condition.value ?? 1}`;
  }
  if (condition.type === "ALLY_RACE_COUNT_AT_LEAST") {
    return `เมื่อมีเผ่า ${raceText(condition.race ?? "HUMAN")} ฝั่งเราอย่างน้อย ${condition.value ?? 1}`;
  }
  if (condition.type === "COMBO_AT_LEAST") {
    return `เมื่อคอมโบอย่างน้อย ${condition.value ?? 0}`;
  }
  if (condition.type === "ENEMY_FRONT_EMPTY") {
    return "เมื่อแนวหน้าศัตรูว่าง";
  }
  if (condition.type === "TARGET_IS_DAMAGED") {
    return "เมื่อเป้าหมายเคยโดนดาเมจ";
  }
  if (condition.type === "SIDE_STACK_AT_LEAST") {
    return `เมื่อมีแต้มฝั่งอย่างน้อย ${condition.value ?? 0}`;
  }
  if (condition.type === "KILL_COUNT_THIS_TURN_AT_LEAST") {
    return `เมื่อฆ่ายูนิตในเทิร์นนี้อย่างน้อย ${condition.value ?? 0}`;
  }
  return `เมื่อราชาเป็นเผ่า ${raceText(condition.race ?? "HUMAN")}`;
}

function opText(ability: Ability): string {
  if (ability.op === "DEAL_DAMAGE") {
    return `สร้างความเสียหาย ${asCountText(ability.amount)}`;
  }
  if (ability.op === "HEAL") {
    return `ฟื้นฟู ${asCountText(ability.amount)}`;
  }
  if (ability.op === "BUFF_ATK") {
    return `เพิ่มพลังโจมตี ${asCountText(ability.amount)}`;
  }
  if (ability.op === "BUFF_HP") {
    return `เพิ่มพลังชีวิต ${asCountText(ability.amount)}`;
  }
  if (ability.op === "DRAW_CARD") {
    return `จั่วการ์ด ${asCountText(ability.drawCount, 1)} ใบ`;
  }
  if (ability.op === "GAIN_SIDE_STACK") {
    return `เพิ่มแต้มฝั่ง ${asCountText(ability.amount)}`;
  }
  if (ability.op === "GAIN_COMBO") {
    return `เพิ่มคอมโบ ${asCountText(ability.amount)}`;
  }
  if (ability.op === "REDUCE_NEXT_TYPE_COST") {
    const scope = ability.appliesToCardTypes?.length
      ? ` (${ability.appliesToCardTypes.join(", ")})`
      : "";
    return `ลดค่าการ์ดถัดไป ${asCountText(ability.amount)}${scope}`;
  }
  if (ability.op === "RESTORE_MANA") {
    return `ฟื้นฟูมานา ${asCountText(ability.amount)}`;
  }
  if (ability.op === "GRANT_KEYWORD") {
    return `มอบ ${keywordText(ability.keyword ?? "WARD")}`;
  }
  if (ability.op === "REMOVE_KEYWORD") {
    return `ลบ ${keywordText(ability.keyword ?? "WARD")}`;
  }
  if (ability.op === "SILENCE") {
    return "ทำให้ติด Silence";
  }
  if (ability.op === "DESTROY") {
    return "ทำลายเป้าหมาย";
  }
  return "อัญเชิญโทเคน";
}

function targetText(target: CardTarget): string {
  const core = `${targetOwnerText(target.owner)} • ${targetZoneText(target.zone)} • ${targetSelectorText(target.selector)}`;
  if (target.count) {
    return `${core} (${target.count} เป้า)`;
  }
  return core;
}

export function explainAbility(ability: Ability): string {
  const detail = `${opText(ability)} -> ${targetText(ability.target)}`;
  const condition = conditionText(ability.condition);
  if (!condition) {
    return detail;
  }
  return `${detail} | เงื่อนไข: ${condition}`;
}

export function explainDeckRequirements(card: DeckCard): string[] {
  const rows: string[] = [];
  const req = card.requirements;
  if (!req) {
    return rows;
  }
  if (req.requiresFaction) {
    rows.push(`ต้องใช้ฝั่ง ${factionText(req.requiresFaction)}`);
  }
  if (req.requiresKingRace) {
    rows.push(`ต้องใช้ราชาเผ่า ${raceText(req.requiresKingRace)}`);
  }
  if (req.requiresClassOnBoard?.length) {
    rows.push(`ต้องมีอาชีพบนกระดาน: ${req.requiresClassOnBoard.map(classTagText).join(", ")}`);
  }
  if (req.requiresRaceOnBoard?.length) {
    rows.push(`ต้องมีเผ่าบนกระดาน: ${req.requiresRaceOnBoard.map(raceText).join(", ")}`);
  }
  if (typeof req.minCombo === "number") {
    rows.push(`ต้องมีคอมโบอย่างน้อย ${req.minCombo}`);
  }
  if (typeof req.minSideStacks === "number") {
    rows.push(`ต้องมีแต้มฝั่งอย่างน้อย ${req.minSideStacks}`);
  }
  return rows;
}

export function explainCardAbilities(card: Card): string[] {
  if (card.kind === "KING") {
    return card.ultimate.effects.map((ability) => explainAbility(ability));
  }
  if (card.kind === "COMMANDER") {
    const burst = card.aura.burst.map((ability) => `BURST: ${explainAbility(ability)}`);
    const pulse = card.aura.pulse.map((ability) => `PULSE: ${explainAbility(ability)}`);
    return [...burst, ...pulse];
  }
  if (!card.abilities?.length) {
    return [];
  }
  return card.abilities.map((ability) => explainAbility(ability));
}

export function chosenTargetCardRule(card: DeckCard): {
  needsTarget: boolean;
  targetHint: string;
  appliesOn: DeckCardType;
} {
  const chosen = card.abilities?.find((ability) => {
    return (
      ["ON_CAST", "ON_PLAY", "ON_SUMMON"].includes(ability.trigger) &&
      ability.target.selector === "CHOSEN"
    );
  });

  if (!chosen) {
    return {
      needsTarget: false,
      targetHint: "การ์ดใบนี้ไม่ต้องเลือกเป้าหมายเอง",
      appliesOn: card.cardType,
    };
  }

  return {
    needsTarget: true,
    targetHint: `ต้องเลือกเป้าหมาย: ${targetText(chosen.target)}`,
    appliesOn: card.cardType,
  };
}

