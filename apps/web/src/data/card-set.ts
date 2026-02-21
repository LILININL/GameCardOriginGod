import manifest from "@/data/cards.alpha.first20.json";
import section01 from "@/data/cards/sections/01.kings.heaven.01.json";
import section02 from "@/data/cards/sections/02.kings.demon.01.json";
import section03 from "@/data/cards/sections/03.kings.neutral.01.json";
import section04 from "@/data/cards/sections/04.commanders.heaven.01.json";
import section05 from "@/data/cards/sections/05.commanders.demon.01.json";
import section06 from "@/data/cards/sections/06.deck.heaven.unit.01.json";
import section07 from "@/data/cards/sections/07.deck.heaven.unit.02.json";
import section08 from "@/data/cards/sections/08.deck.heaven.unit.03.json";
import section09 from "@/data/cards/sections/09.deck.heaven.unit.04.json";
import section10 from "@/data/cards/sections/10.deck.heaven.spell-generic.01.json";
import section11 from "@/data/cards/sections/11.deck.heaven.spell-class.01.json";
import section12 from "@/data/cards/sections/12.deck.heaven.skill-race.01.json";
import section13 from "@/data/cards/sections/13.deck.heaven.skill-side.01.json";
import section14 from "@/data/cards/sections/14.deck.demon.unit.01.json";
import section15 from "@/data/cards/sections/15.deck.demon.unit.02.json";
import section16 from "@/data/cards/sections/16.deck.demon.unit.03.json";
import section17 from "@/data/cards/sections/17.deck.demon.unit.04.json";
import section18 from "@/data/cards/sections/18.deck.demon.spell-generic.01.json";
import section19 from "@/data/cards/sections/19.deck.demon.spell-class.01.json";
import section20 from "@/data/cards/sections/20.deck.demon.skill-race.01.json";
import section21 from "@/data/cards/sections/21.deck.demon.skill-side.01.json";
import section22 from "@/data/cards/sections/22.deck.neutral.unit.01.json";
import section23 from "@/data/cards/sections/23.deck.neutral.unit.02.json";
import section24 from "@/data/cards/sections/24.deck.neutral.unit.03.json";
import section25 from "@/data/cards/sections/25.deck.neutral.spell-generic.01.json";
import section26 from "@/data/cards/sections/26.deck.neutral.spell-generic.02.json";
import section27 from "@/data/cards/sections/27.deck.neutral.spell-class.01.json";
import section28 from "@/data/cards/sections/28.deck.neutral.spell-class.02.json";
import section29 from "@/data/cards/sections/29.deck.neutral.skill-race.01.json";
import section30 from "@/data/cards/sections/30.deck.neutral.skill-side.01.json";

import { type Card } from "@/lib/game/types";

interface SectionFile {
  sectionId: string;
  title: string;
  kind: string;
  faction: string;
  cardType: string | null;
  cards: unknown[];
}

const sectionFiles: SectionFile[] = [
  section01,
  section02,
  section03,
  section04,
  section05,
  section06,
  section07,
  section08,
  section09,
  section10,
  section11,
  section12,
  section13,
  section14,
  section15,
  section16,
  section17,
  section18,
  section19,
  section20,
  section21,
  section22,
  section23,
  section24,
  section25,
  section26,
  section27,
  section28,
  section29,
  section30,
];

export const cardSections = sectionFiles;

export const cardSet = {
  set: manifest.set,
  schemaRef: manifest.schemaRef,
  generatedOn: manifest.generatedOn,
  cards: sectionFiles.flatMap((section) => section.cards) as Card[],
  sections: manifest.sections,
};

export default cardSet;
