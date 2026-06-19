const DEFAULT_LEVEL_REWARDS = {
  1: { fragments: 150 },
  2: { fragments: 300 },
  3: { fragments: 600 },
  4: { fragments: 1000 },
  5: { fragments: 2000 },
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
    name: "Noxus",
    emoji: "🔴",
    description: "Les personnages liés à Noxus, aux Medarda et aux jeux de pouvoir militaires.",
    matchTags: ["Noxus", "Medarda"],
    matchFactions: ["Noxus"],
    excludeFusion: true,
    rewards: {
      ...DEFAULT_LEVEL_REWARDS,
      5: { fragments: 2000, title: "Sang de Noxus" },
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
      ...DEFAULT_LEVEL_REWARDS,
      5: { fragments: 2000, title: "Lumière de Zaun" },
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
    key: "rose_noire",
    name: "Rose Noire",
    emoji: "🌹",
    description: "Les cartes liées à la Rose Noire, à LeBlanc, à la magie et aux manipulations noxiennes.",
    matchTags: ["Rose Noire", "LeBlanc", "Magie"],
    matchFactions: ["Rose Noire", "Noxus / Rose Noire"],
    excludeFusion: true,
    rewards: {
      ...DEFAULT_LEVEL_REWARDS,
      5: { fragments: 2000, title: "Élu de la Rose Noire" },
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
