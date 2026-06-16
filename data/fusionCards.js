const FUSION_INFO = {
  common: { label: "Fusion commune", value: 30 },
  rare: { label: "Fusion rare", value: 120 },
  epic: { label: "Fusion épique", value: 360 },
  legendary: { label: "Fusion légendaire", value: 1050 },
  mythic: { label: "Fusion mythique", value: 3000 },
}

function createFusionCard({
  key,
  name,
  characterName,
  rarity,
  description,
  image = "",
  faction = "Fusion",
  season = "Fusion",
  tags = [],
  ingredients = [],
}) {
  const fusionInfo = FUSION_INFO[rarity]

  if (!fusionInfo) {
    throw new Error(`Rareté de fusion invalide pour ${name}: ${rarity}`)
  }

  if (!ingredients.length || ingredients.length < 2) {
    throw new Error(`Fusion invalide pour ${name}: au moins 2 ingrédients sont requis`)
  }

  return {
    key,
    name,
    characterName,
    rarity,
    rarityLabel: fusionInfo.label,
    value: fusionInfo.value,
    image,
    description,
    faction,
    season,
    tags: ["Fusion", ...tags],
    source: "fusion",
    isPullable: false,
    fusionBonusPercent: 10,
    ingredients,
  }
}

const fusionCards = [
  // =========================
  // FUSIONS COMMUNES
  // =========================
  createFusionCard({
    key: "fusion_jinx_ekko_common",
    name: "Jinx & Ekko — Souvenirs de Zaun",
    characterName: "Jinx & Ekko",
    rarity: "common",
    description: "Une carte fusion unique née de Powder et du jeune Ekko, souvenir d'une Zaun encore pleine d'espoir.",
    faction: "Zaun",
    tags: ["Zaun", "Jinx", "Ekko", "Enfance"],
    ingredients: ["jinx_common_powder", "ekko_common_petit_genie_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_vi_caitlyn_common",
    name: "Vi & Caitlyn — Alliance fragile",
    characterName: "Vi & Caitlyn",
    rarity: "common",
    description: "Une carte fusion unique représentant le premier lien entre Zaun et Piltover.",
    faction: "Piltover / Zaun",
    tags: ["Piltover", "Zaun", "Vi", "Caitlyn"],
    ingredients: ["vi_common_violet", "caitlyn_common_heritiere_kiramman"],
  }),

  createFusionCard({
    key: "fusion_jayce_viktor_common",
    name: "Jayce & Viktor — Promesse Hextech",
    characterName: "Jayce & Viktor",
    rarity: "common",
    description: "Une carte fusion unique représentant la naissance d'un rêve scientifique.",
    faction: "Piltover",
    tags: ["Piltover", "Hextech", "Science"],
    ingredients: ["jayce_common_etudiant_ambitieux", "viktor_common_assistant_de_l_academie"],
  }),

  createFusionCard({
    key: "fusion_mylo_claggor_common",
    name: "Mylo & Claggor — Bande de Vander",
    characterName: "Mylo & Claggor",
    rarity: "common",
    description: "Une carte fusion dédiée aux deux amis d'enfance de Vi et Powder.",
    faction: "Zaun",
    tags: ["Zaun", "Vander", "Enfance"],
    ingredients: ["mylo_common_jeune_voleur", "claggor_common_jeune_protecteur"],
  }),

  createFusionCard({
    key: "fusion_benzo_huck_common",
    name: "Benzo & Huck — Ombres du Last Drop",
    characterName: "Benzo & Huck",
    rarity: "common",
    description: "Une carte fusion des visages ordinaires et fragiles de Zaun.",
    faction: "Zaun",
    tags: ["Zaun", "Last Drop", "Commerce"],
    ingredients: ["benzo_common_marchand_de_zaun", "huck_common_client_du_last_drop"],
  }),

  createFusionCard({
    key: "fusion_heimerdinger_ekko_common",
    name: "Heimerdinger & Ekko — Génies improbables",
    characterName: "Heimerdinger & Ekko",
    rarity: "common",
    description: "Une carte fusion entre la prudence de Piltover et l'ingéniosité de Zaun.",
    faction: "Piltover / Firelights",
    tags: ["Piltover", "Firelights", "Science", "Yordle"],
    ingredients: ["heimerdinger_common_professeur", "ekko_common_petit_genie_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_salo_shoola_common",
    name: "Salo & Shoola — Conseil de Piltover",
    characterName: "Salo & Shoola",
    rarity: "common",
    description: "Une carte fusion des jeux politiques du Conseil de Piltover.",
    faction: "Piltover",
    tags: ["Piltover", "Conseil", "Politique"],
    ingredients: ["salo_common_conseiller_de_piltover", "shoola_common_conseillere"],
  }),

  createFusionCard({
    key: "fusion_hoskel_bolbok_common",
    name: "Hoskel & Bolbok — Voix du Conseil",
    characterName: "Hoskel & Bolbok",
    rarity: "common",
    description: "Une carte fusion représentant les voix secondaires du pouvoir piltovien.",
    faction: "Piltover",
    tags: ["Piltover", "Conseil"],
    ingredients: ["hoskel_common_conseiller", "bolbok_common_conseiller"],
  }),

  createFusionCard({
    key: "fusion_marcus_maddie_common",
    name: "Marcus & Maddie — Ligne bleue",
    characterName: "Marcus & Maddie",
    rarity: "common",
    description: "Une carte fusion sur les Enforcers pris entre devoir, ambition et loyauté.",
    faction: "Piltover",
    tags: ["Piltover", "Enforcer"],
    ingredients: ["marcus_common_enforcer_ambitieux", "maddie_common_enforcer_enthousiaste"],
  }),

  createFusionCard({
    key: "fusion_loris_steb_common",
    name: "Loris & Steb — Patrouille silencieuse",
    characterName: "Loris & Steb",
    rarity: "common",
    description: "Une carte fusion de terrain pour les Enforcers de Piltover.",
    faction: "Piltover",
    tags: ["Piltover", "Enforcer", "Terrain"],
    ingredients: ["loris_common_enforcer_massif", "steb_common_enforcer_silencieux"],
  }),

  createFusionCard({
    key: "fusion_mel_elora_common",
    name: "Mel & Elora — Influence discrète",
    characterName: "Mel & Elora",
    rarity: "common",
    description: "Une carte fusion du pouvoir qui s'exerce dans les couloirs de Piltover.",
    faction: "Piltover",
    tags: ["Piltover", "Mel", "Politique"],
    ingredients: ["mel_common_conseillere", "elora_common_assistante_de_mel"],
  }),

  createFusionCard({
    key: "fusion_viktor_sky_common",
    name: "Viktor & Sky — Science silencieuse",
    characterName: "Viktor & Sky",
    rarity: "common",
    description: "Une carte fusion des laboratoires, des espoirs et des regrets.",
    faction: "Piltover",
    tags: ["Piltover", "Science", "Viktor"],
    ingredients: ["viktor_common_assistant_de_l_academie", "sky_common_assistante_de_viktor"],
  }),

  createFusionCard({
    key: "fusion_deckard_lock_common",
    name: "Deckard & Lock — Brutes des bas-fonds",
    characterName: "Deckard & Lock",
    rarity: "common",
    description: "Une carte fusion des sbires violents qui hantent les rues de Zaun.",
    faction: "Zaun",
    tags: ["Zaun", "Crime", "Brute"],
    ingredients: ["deckard_common_brute_de_zaun", "lock_common_homme_de_main"],
  }),

  createFusionCard({
    key: "fusion_scar_lest_common",
    name: "Scar & Lest — Contacts de Zaun",
    characterName: "Scar & Lest",
    rarity: "common",
    description: "Une carte fusion des réseaux discrets de la résistance et de l'information.",
    faction: "Zaun / Firelights",
    tags: ["Zaun", "Firelights", "Information"],
    ingredients: ["scar_common_firelight", "lest_common_informateur"],
  }),

  createFusionCard({
    key: "fusion_babette_gert_common",
    name: "Babette & Gert — Nuits de Zaun",
    characterName: "Babette & Gert",
    rarity: "common",
    description: "Une carte fusion des lieux, des voix et des regards de Zaun.",
    faction: "Zaun",
    tags: ["Zaun", "Nuit", "Secondaire"],
    ingredients: ["babette_common_tenanciere_de_zaun", "gert_common_habitante_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_caitlyn_tobias_common",
    name: "Caitlyn & Tobias — Héritage Kiramman",
    characterName: "Caitlyn & Tobias",
    rarity: "common",
    description: "Une carte fusion du nom Kiramman et de son poids familial.",
    faction: "Piltover",
    tags: ["Piltover", "Kiramman", "Famille"],
    ingredients: ["caitlyn_common_heritiere_kiramman", "tobias_common_pere_de_caitlyn"],
  }),

  // =========================
  // FUSIONS RARES
  // =========================
  createFusionCard({
    key: "fusion_jinx_silco_rare",
    name: "Jinx & Silco — Héritage toxique",
    characterName: "Jinx & Silco",
    rarity: "rare",
    description: "Une fusion rare entre l'instabilité de Jinx et l'emprise de Silco.",
    faction: "Zaun",
    tags: ["Zaun", "Jinx", "Silco", "Shimmer"],
    ingredients: ["jinx_rare_inventrice_instable", "silco_rare_chef_de_l_ombre"],
  }),

  createFusionCard({
    key: "fusion_vi_vander_rare",
    name: "Vi & Vander — Poings de famille",
    characterName: "Vi & Vander",
    rarity: "rare",
    description: "Une fusion rare entre la rage de Vi et l'héritage protecteur de Vander.",
    faction: "Zaun",
    tags: ["Zaun", "Famille", "Combat"],
    ingredients: ["vi_rare_prisonniere_de_stillwater", "vander_rare_protecteur_du_last_drop"],
  }),

  createFusionCard({
    key: "fusion_caitlyn_grayson_rare",
    name: "Caitlyn & Grayson — Justice de Piltover",
    characterName: "Caitlyn & Grayson",
    rarity: "rare",
    description: "Une fusion rare de l'autorité piltovienne et de l'idéal de justice.",
    faction: "Piltover",
    tags: ["Piltover", "Enforcer", "Justice"],
    ingredients: ["caitlyn_rare_enquetrice", "grayson_rare_sheriff_de_piltover"],
  }),

  createFusionCard({
    key: "fusion_ekko_scar_rare",
    name: "Ekko & Scar — Résistance Firelight",
    characterName: "Ekko & Scar",
    rarity: "rare",
    description: "Une fusion rare de la résistance organisée contre le chaos de Zaun.",
    faction: "Firelights",
    tags: ["Firelights", "Zaun", "Résistance"],
    ingredients: ["ekko_rare_chef_des_firelights", "scar_rare_guerrier_firelight"],
  }),

  createFusionCard({
    key: "fusion_jayce_viktor_rare",
    name: "Jayce & Viktor — Pionniers Hextech",
    characterName: "Jayce & Viktor",
    rarity: "rare",
    description: "Une fusion rare du rêve Hextech avant sa fracture.",
    faction: "Piltover",
    tags: ["Piltover", "Hextech", "Science"],
    ingredients: ["jayce_rare_inventeur_hextech", "viktor_rare_scientifique_hextech"],
  }),

  createFusionCard({
    key: "fusion_mel_ambessa_rare",
    name: "Mel & Ambessa — Sang Medarda",
    characterName: "Mel & Ambessa",
    rarity: "rare",
    description: "Une fusion rare entre diplomatie piltovienne et brutalité noxienne.",
    faction: "Piltover / Noxus",
    tags: ["Noxus", "Piltover", "Medarda"],
    ingredients: ["mel_rare_stratege_politique", "ambessa_rare_generale_noxienne"],
  }),

  createFusionCard({
    key: "fusion_silco_sevika_rare",
    name: "Silco & Sevika — Pouvoir des bas-fonds",
    characterName: "Silco & Sevika",
    rarity: "rare",
    description: "Une fusion rare entre stratégie criminelle et force armée.",
    faction: "Zaun",
    tags: ["Zaun", "Silco", "Sevika", "Crime"],
    ingredients: ["silco_rare_chef_de_l_ombre", "sevika_rare_lieutenante_de_silco"],
  }),

  createFusionCard({
    key: "fusion_singed_deckard_rare",
    name: "Singed & Deckard — Premier Shimmer",
    characterName: "Singed & Deckard",
    rarity: "rare",
    description: "Une fusion rare liée aux premières horreurs du Shimmer.",
    faction: "Zaun",
    tags: ["Zaun", "Shimmer", "Expérience"],
    ingredients: ["singed_rare_docteur_reveck", "deckard_rare_mute_au_shimmer"],
  }),

  createFusionCard({
    key: "fusion_ambessa_kino_rare",
    name: "Ambessa & Kino — Deuil noxien",
    characterName: "Ambessa & Kino",
    rarity: "rare",
    description: "Une fusion rare du poids familial qui poursuit la maison Medarda.",
    faction: "Noxus",
    tags: ["Noxus", "Medarda", "Famille"],
    ingredients: ["ambessa_rare_generale_noxienne", "kino_rare_heritier_perdu"],
  }),

  createFusionCard({
    key: "fusion_marcus_silco_rare",
    name: "Marcus & Silco — Pacte compromis",
    characterName: "Marcus & Silco",
    rarity: "rare",
    description: "Une fusion rare de corruption, peur et pouvoir clandestin.",
    faction: "Piltover / Zaun",
    tags: ["Piltover", "Zaun", "Corruption", "Silco"],
    ingredients: ["marcus_rare_sheriff_compromis", "silco_rare_chef_de_l_ombre"],
  }),

  createFusionCard({
    key: "fusion_cassandra_caitlyn_rare",
    name: "Cassandra & Caitlyn — Maison Kiramman",
    characterName: "Cassandra & Caitlyn",
    rarity: "rare",
    description: "Une fusion rare de devoir, héritage et pouvoir familial.",
    faction: "Piltover",
    tags: ["Piltover", "Kiramman", "Famille"],
    ingredients: ["cassandra_rare_matriarche_kiramman", "caitlyn_rare_enquetrice"],
  }),

  createFusionCard({
    key: "fusion_maddie_caitlyn_rare",
    name: "Maddie & Caitlyn — Autorité trouble",
    characterName: "Maddie & Caitlyn",
    rarity: "rare",
    description: "Une fusion rare sur la loyauté, l'ambition et les tensions des Enforcers.",
    faction: "Piltover",
    tags: ["Piltover", "Enforcer", "Caitlyn"],
    ingredients: ["maddie_rare_loyaute_trouble", "caitlyn_rare_enquetrice"],
  }),

  createFusionCard({
    key: "fusion_finn_renni_rare",
    name: "Finn & Renni — Conseil des Chem-Barons",
    characterName: "Finn & Renni",
    rarity: "rare",
    description: "Une fusion rare des ambitions concurrentes des Chem-Barons.",
    faction: "Zaun",
    tags: ["Zaun", "Chem-Baron", "Crime"],
    ingredients: ["finn_rare_chem_baron_arrogant", "renni_rare_chem_baronne"],
  }),

  createFusionCard({
    key: "fusion_smeech_chross_rare",
    name: "Smeech & Chross — Marché noir de Zaun",
    characterName: "Smeech & Chross",
    rarity: "rare",
    description: "Une fusion rare des intérêts mécaniques et criminels de Zaun.",
    faction: "Zaun",
    tags: ["Zaun", "Chem-Baron", "Pouvoir"],
    ingredients: ["smeech_rare_chem_baron_yordle", "chross_rare_baron_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_huck_singed_rare",
    name: "Huck & Singed — Dépendance au Shimmer",
    characterName: "Huck & Singed",
    rarity: "rare",
    description: "Une fusion rare sur les victimes et les artisans du Shimmer.",
    faction: "Zaun",
    tags: ["Zaun", "Shimmer", "Tragédie"],
    ingredients: ["huck_rare_dependant_du_shimmer", "singed_rare_docteur_reveck"],
  }),

  // =========================
  // FUSIONS ÉPIQUES
  // =========================
  createFusionCard({
    key: "fusion_jinx_vi_epic",
    name: "Jinx & Vi — Sœurs fracturées",
    characterName: "Jinx & Vi",
    rarity: "epic",
    description: "Une fusion épique de rage, culpabilité et amour impossible.",
    faction: "Zaun",
    tags: ["Zaun", "Jinx", "Vi", "Famille"],
    ingredients: ["jinx_epic_tireuse_de_zaun", "vi_epic_combattante_des_bas_fonds"],
  }),

  createFusionCard({
    key: "fusion_jinx_silco_epic",
    name: "Jinx & Silco — Monstre et père",
    characterName: "Jinx & Silco",
    rarity: "epic",
    description: "Une fusion épique de l'affection la plus toxique de Zaun.",
    faction: "Zaun",
    tags: ["Zaun", "Jinx", "Silco", "Tragédie"],
    ingredients: ["jinx_epic_tireuse_de_zaun", "silco_epic_parrain_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_ekko_heimerdinger_epic",
    name: "Ekko & Heimerdinger — Espoir Firelight",
    characterName: "Ekko & Heimerdinger",
    rarity: "epic",
    description: "Une fusion épique de sagesse ancienne et d'invention rebelle.",
    faction: "Firelights",
    tags: ["Firelights", "Yordle", "Science", "Zaun"],
    ingredients: ["ekko_epic_sur_son_hoverboard", "heimerdinger_epic_ami_des_firelights"],
  }),

  createFusionCard({
    key: "fusion_jayce_mel_epic",
    name: "Jayce & Mel — Pouvoir Hextech",
    characterName: "Jayce & Mel",
    rarity: "epic",
    description: "Une fusion épique entre progrès scientifique et stratégie politique.",
    faction: "Piltover",
    tags: ["Piltover", "Hextech", "Politique"],
    ingredients: ["jayce_epic_conseiller", "mel_epic_heritiere_medarda"],
  }),

  createFusionCard({
    key: "fusion_jayce_viktor_epic",
    name: "Jayce & Viktor — Fracture Hexcore",
    characterName: "Jayce & Viktor",
    rarity: "epic",
    description: "Une fusion épique de deux ambitions liées par le Hexcore.",
    faction: "Piltover / Hextech",
    tags: ["Piltover", "Hextech", "Hexcore"],
    ingredients: ["jayce_epic_conseiller", "viktor_epic_touche_par_le_hexcore"],
  }),

  createFusionCard({
    key: "fusion_viktor_sky_epic",
    name: "Viktor & Sky — Écho du regret",
    characterName: "Viktor & Sky",
    rarity: "epic",
    description: "Une fusion épique d'obsession scientifique et de perte silencieuse.",
    faction: "Piltover / Hextech",
    tags: ["Hexcore", "Viktor", "Sky", "Souvenir"],
    ingredients: ["viktor_epic_touche_par_le_hexcore", "sky_epic_echo_du_hexcore"],
  }),

  createFusionCard({
    key: "fusion_sevika_smeech_epic",
    name: "Sevika & Smeech — Métal de Zaun",
    characterName: "Sevika & Smeech",
    rarity: "epic",
    description: "Une fusion épique de mécanique brutale et de pouvoir des bas-fonds.",
    faction: "Zaun",
    tags: ["Zaun", "Mécanique", "Chem-Baron"],
    ingredients: ["sevika_epic_bras_mecanique", "smeech_epic_mecanique_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_cassandra_mel_epic",
    name: "Cassandra & Mel — Conseil doré",
    characterName: "Cassandra & Mel",
    rarity: "epic",
    description: "Une fusion épique des maisons influentes et des décisions de Piltover.",
    faction: "Piltover",
    tags: ["Piltover", "Conseil", "Politique"],
    ingredients: ["cassandra_epic_conseillere", "mel_epic_heritiere_medarda"],
  }),

  createFusionCard({
    key: "fusion_ambessa_mel_epic",
    name: "Ambessa & Mel — Héritage Medarda",
    characterName: "Ambessa & Mel",
    rarity: "epic",
    description: "Une fusion épique entre l'héritage noxien et la finesse de Piltover.",
    faction: "Piltover / Noxus",
    tags: ["Noxus", "Piltover", "Medarda"],
    ingredients: ["ambessa_epic_mere_de_mel", "mel_epic_heritiere_medarda"],
  }),

  createFusionCard({
    key: "fusion_singed_sevika_epic",
    name: "Singed & Sevika — Shimmer armé",
    characterName: "Singed & Sevika",
    rarity: "epic",
    description: "Une fusion épique de science toxique et de violence mécanique.",
    faction: "Zaun",
    tags: ["Zaun", "Shimmer", "Combat"],
    ingredients: ["singed_epic_maitre_du_shimmer", "sevika_epic_bras_mecanique"],
  }),

  // =========================
  // FUSIONS LÉGENDAIRES
  // =========================
  createFusionCard({
    key: "fusion_jinx_vi_legendary",
    name: "Jinx & Vi — Dernière étreinte",
    characterName: "Jinx & Vi",
    rarity: "legendary",
    description: "Une fusion légendaire du lien brisé entre deux sœurs devenues symboles.",
    faction: "Zaun",
    tags: ["Zaun", "Jinx", "Vi", "Famille", "Légende"],
    ingredients: ["jinx_legendary_legende_de_zaun", "vi_legendary_gants_hextech"],
  }),

  createFusionCard({
    key: "fusion_vi_caitlyn_legendary",
    name: "Vi & Caitlyn — Pont entre deux mondes",
    characterName: "Vi & Caitlyn",
    rarity: "legendary",
    description: "Une fusion légendaire entre la force de Zaun et la justice de Piltover.",
    faction: "Piltover / Zaun",
    tags: ["Piltover", "Zaun", "Vi", "Caitlyn"],
    ingredients: ["vi_legendary_gants_hextech", "caitlyn_legendary_commandante"],
  }),

  createFusionCard({
    key: "fusion_jayce_viktor_legendary",
    name: "Jayce & Viktor — Rêve brisé du progrès",
    characterName: "Jayce & Viktor",
    rarity: "legendary",
    description: "Une fusion légendaire de deux visions opposées du progrès.",
    faction: "Piltover / Hextech",
    tags: ["Piltover", "Hextech", "Progrès"],
    ingredients: ["jayce_legendary_marteau_mercury", "viktor_legendary_apotre_du_progres"],
  }),

  createFusionCard({
    key: "fusion_silco_warwick_legendary",
    name: "Silco & Warwick — Fantômes de Vander",
    characterName: "Silco & Warwick",
    rarity: "legendary",
    description: "Une fusion légendaire de trahison, mémoire et monstruosité.",
    faction: "Zaun",
    tags: ["Zaun", "Silco", "Warwick", "Vander"],
    ingredients: ["silco_legendary_pere_de_jinx", "warwick_legendary_bete_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_singed_warwick_legendary",
    name: "Singed & Warwick — Création monstrueuse",
    characterName: "Singed & Warwick",
    rarity: "legendary",
    description: "Une fusion légendaire du savant et de sa création la plus douloureuse.",
    faction: "Zaun",
    tags: ["Zaun", "Singed", "Warwick", "Science"],
    ingredients: ["singed_legendary_createur_de_monstres", "warwick_legendary_bete_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_mel_leblanc_legendary",
    name: "Mel & LeBlanc — Rose et lumière",
    characterName: "Mel & LeBlanc",
    rarity: "legendary",
    description: "Une fusion légendaire entre magie révélée et manipulation de la Rose Noire.",
    faction: "Noxus / Rose Noire",
    tags: ["Noxus", "Rose Noire", "Magie"],
    ingredients: ["mel_legendary_mage_revelee", "leblanc_legendary_rose_noire"],
  }),

  createFusionCard({
    key: "fusion_ambessa_mel_legendary",
    name: "Ambessa & Mel — Mère et héritière",
    characterName: "Ambessa & Mel",
    rarity: "legendary",
    description: "Une fusion légendaire du conflit entre amour familial et pouvoir militaire.",
    faction: "Piltover / Noxus",
    tags: ["Noxus", "Medarda", "Mel", "Ambessa"],
    ingredients: ["ambessa_legendary_louve_de_noxus", "mel_legendary_mage_revelee"],
  }),

  createFusionCard({
    key: "fusion_heimerdinger_janna_legendary",
    name: "Heimerdinger & Janna — Mémoire des siècles",
    characterName: "Heimerdinger & Janna",
    rarity: "legendary",
    description: "Une fusion légendaire de science ancienne et de mythe oublié.",
    faction: "Piltover / Zaun",
    tags: ["Yordle", "Janna", "Mythe", "Science"],
    ingredients: ["heimerdinger_legendary_savant_intemporel", "janna_legendary_deesse_oubliee_de_zaun"],
  }),

  createFusionCard({
    key: "fusion_viktor_hexcore_legendary",
    name: "Viktor & Hexcore — Évolution interdite",
    characterName: "Viktor & Hexcore",
    rarity: "legendary",
    description: "Une fusion légendaire entre l'homme et l'anomalie qui répond à son appel.",
    faction: "Hextech",
    tags: ["Hextech", "Hexcore", "Viktor", "Évolution"],
    ingredients: ["viktor_legendary_apotre_du_progres", "hexcore_legendary_anomalie_arcanique"],
  }),

  createFusionCard({
    key: "fusion_singed_orianna_legendary",
    name: "Singed & Orianna — Cœur préservé",
    characterName: "Singed & Orianna",
    rarity: "legendary",
    description: "Une fusion légendaire du sacrifice scientifique et de l'amour paternel.",
    faction: "Zaun",
    tags: ["Zaun", "Singed", "Orianna", "Famille"],
    ingredients: ["singed_legendary_createur_de_monstres", "orianna_legendary_fille_du_docteur"],
  }),

  // =========================
  // FUSIONS MYTHIQUES
  // =========================
  createFusionCard({
    key: "fusion_jinx_vi_mythic",
    name: "Jinx & Vi — Ce qui reste de nous",
    characterName: "Jinx & Vi",
    rarity: "mythic",
    description: "Une fusion mythique du traumatisme, de la rage et de l'amour qui survit à tout.",
    faction: "Zaun",
    tags: ["Mythique", "Zaun", "Jinx", "Vi", "Famille"],
    ingredients: ["jinx_mythic_blue_flare", "vi_mythic_protectrice_brisee"],
  }),

  createFusionCard({
    key: "fusion_jinx_ekko_mythic",
    name: "Jinx & Ekko — Temps suspendu",
    characterName: "Jinx & Ekko",
    rarity: "mythic",
    description: "Une fusion mythique entre chaos, souvenir et secondes volées au destin.",
    faction: "Zaun / Firelights",
    tags: ["Mythique", "Jinx", "Ekko", "Temps", "Zaun"],
    ingredients: ["jinx_mythic_blue_flare", "ekko_mythic_z_drive"],
  }),

  createFusionCard({
    key: "fusion_caitlyn_vi_mythic",
    name: "Caitlyn & Vi — Justice impossible",
    characterName: "Caitlyn & Vi",
    rarity: "mythic",
    description: "Une fusion mythique entre amour, devoir et fracture politique.",
    faction: "Piltover / Zaun",
    tags: ["Mythique", "Caitlyn", "Vi", "Justice"],
    ingredients: ["caitlyn_mythic_il_de_piltover", "vi_mythic_protectrice_brisee"],
  }),

  createFusionCard({
    key: "fusion_jayce_viktor_mythic",
    name: "Jayce & Viktor — Accélération finale",
    characterName: "Jayce & Viktor",
    rarity: "mythic",
    description: "Une fusion mythique de deux destins liés à l'apocalypse Hextech.",
    faction: "Hextech",
    tags: ["Mythique", "Hextech", "Jayce", "Viktor"],
    ingredients: ["jayce_mythic_defenseur_brise", "viktor_mythic_glorious_evolution"],
  }),

  createFusionCard({
    key: "fusion_mel_ambessa_mythic",
    name: "Mel & Ambessa — Lignée de guerre",
    characterName: "Mel & Ambessa",
    rarity: "mythic",
    description: "Une fusion mythique du pouvoir Medarda entre lumière et conquête.",
    faction: "Noxus / Piltover",
    tags: ["Mythique", "Noxus", "Medarda", "Magie"],
    ingredients: ["mel_mythic_lumiere_doree", "ambessa_mythic_matriarche_de_guerre"],
  }),

  createFusionCard({
    key: "fusion_silco_jinx_mythic",
    name: "Silco & Jinx — Nation de cendres",
    characterName: "Silco & Jinx",
    rarity: "mythic",
    description: "Une fusion mythique du rêve de Zaun et de son symbole le plus explosif.",
    faction: "Zaun",
    tags: ["Mythique", "Zaun", "Silco", "Jinx"],
    ingredients: ["silco_mythic_reve_de_zaun", "jinx_mythic_blue_flare"],
  }),

  createFusionCard({
    key: "fusion_warwick_viktor_mythic",
    name: "Warwick & Viktor — Humanité dissoute",
    characterName: "Warwick & Viktor",
    rarity: "mythic",
    description: "Une fusion mythique entre l'évolution forcée et la mémoire d'un homme perdu.",
    faction: "Hextech / Zaun",
    tags: ["Mythique", "Warwick", "Viktor", "Évolution"],
    ingredients: ["warwick_mythic_vander_eveille", "viktor_mythic_glorious_evolution"],
  }),

  createFusionCard({
    key: "fusion_leblanc_ambessa_mythic",
    name: "LeBlanc & Ambessa — Guerre de la Rose",
    characterName: "LeBlanc & Ambessa",
    rarity: "mythic",
    description: "Une fusion mythique entre la manipulation de la Rose Noire et la force de Noxus.",
    faction: "Noxus / Rose Noire",
    tags: ["Mythique", "Noxus", "Rose Noire", "Guerre"],
    ingredients: ["leblanc_mythic_illusion_de_la_rose", "ambessa_mythic_matriarche_de_guerre"],
  }),

  createFusionCard({
    key: "fusion_isha_jinx_mythic",
    name: "Isha & Jinx — Dernière étincelle",
    characterName: "Isha & Jinx",
    rarity: "mythic",
    description: "Une fusion mythique de sacrifice, d'innocence et de feu bleu.",
    faction: "Zaun",
    tags: ["Mythique", "Zaun", "Isha", "Jinx", "Tragédie"],
    ingredients: ["isha_mythic_sacrifice", "jinx_mythic_blue_flare"],
  }),
]

module.exports = fusionCards