const DEFAULT_LEVEL_REWARDS = {
  1: { fragments: 150 },
  2: { fragments: 300 },
  3: { fragments: 600 },
  4: { fragments: 1000 },
  5: { fragments: 2000 },
}

const SMALL_LEVEL_REWARDS = {
  1: { fragments: 100 },
  2: { fragments: 200 },
  3: { fragments: 400 },
  4: { fragments: 700 },
  5: { fragments: 1200 },
}

const FUSION_LEVEL_REWARDS = {
  1: { fragments: 300 },
  2: { fragments: 600 },
  3: { fragments: 1200 },
  4: { fragments: 2000 },
  5: { fragments: 3500, title: "Maître des Fusions" },
}

module.exports = [
  {
    key: "zaun",
    name: "Zaun",
    emoji: "🟢",
    description: "Les figures majeures des bas-fonds, du Shimmer et de la résistance zaunienne.",
    matchTags: ["Zaun"],
    matchFactions: ["Zaun"],
    excludeFusion: true,
    rewards: {
      ...DEFAULT_LEVEL_REWARDS,
      5: { fragments: 2000, title: "Enfant de Zaun" },
    },
  },
  {
    key: "piltover",
    name: "Piltover",
    emoji: "🔵",
    description: "Les grandes figures de Piltover, de l'Académie, du Conseil et des Enforcers.",
    matchTags: ["Piltover", "Enforcer", "Kiramman"],
    matchFactions: ["Piltover"],
    excludeFusion: true,
    rewards: {
      ...DEFAULT_LEVEL_REWARDS,
      5: { fragments: 2000, title: "Héritier de Piltover" },
    },
  },
  {
    key: "noxus",
    name: "Noxus & Rose Noire",
    emoji: "🔴",
    description: "Les cartes liées à Noxus, aux Medarda, à la Rose Noire et aux manipulations politiques.",
    matchTags: ["Noxus", "Medarda", "Rose Noire", "LeBlanc", "Magie"],
    matchFactions: ["Noxus", "Rose Noire", "Noxus / Rose Noire"],
    excludeFusion: true,
    rewards: {
      ...SMALL_LEVEL_REWARDS,
      5: { fragments: 1200, title: "Main de Noxus" },
    },
  },
  {
    key: "firelights",
    name: "Firelights",
    emoji: "🟣",
    description: "Les cartes liées aux Firelights, à Ekko et à la résistance organisée.",
    matchTags: ["Firelights", "Firelight", "Ekko"],
    matchFactions: ["Firelights", "Firelight"],
    excludeFusion: true,
    rewards: {
      ...SMALL_LEVEL_REWARDS,
      5: { fragments: 1200, title: "Lumière de Zaun" },
    },
  },
  {
    key: "hextech",
    name: "Hextech",
    emoji: "⚙️",
    description: "Les cartes liées à la science, à l'Hextech, au Hexcore et aux inventeurs.",
    matchTags: ["Hextech", "Hexcore", "Science", "Viktor", "Jayce", "Heimerdinger", "Sky"],
    matchFactions: ["Hextech", "Piltover / Hextech"],
    excludeFusion: true,
    rewards: {
      ...DEFAULT_LEVEL_REWARDS,
      5: { fragments: 2000, title: "Pionnier Hextech" },
    },
  },
  {
    key: "fusions",
    name: "Fusions",
    emoji: "🧬",
    description: "Toutes les cartes fusion créées avec plusieurs cartes.",
    source: "fusion",
    excludeFusion: false,
    rewards: FUSION_LEVEL_REWARDS,
  },
]
