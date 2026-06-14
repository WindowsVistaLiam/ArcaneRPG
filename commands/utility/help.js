const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const HELP_CATEGORIES = {
  accueil: {
    label: "🏠 Accueil",
    color: 0x5865f2,
  },
  personnage: {
    label: "👤 Personnages",
    color: 0x3498db,
  },
  gacha: {
    label: "🎴 Gacha",
    color: 0x9b59b6,
  },
  boutique: {
    label: "🛒 Boutique",
    color: 0xf1c40f,
  },
  combat: {
    label: "⚔️ Combat",
    color: 0xe74c3c,
  },
  collection: {
    label: "📘 Collection",
    color: 0x2ecc71,
  },
  admin: {
    label: "🛠️ Admin",
    color: 0xe67e22,
  },
}

function buildHelpEmbed(category = "accueil") {
  const safeCategory = HELP_CATEGORIES[category] ? category : "accueil"
  const categoryData = HELP_CATEGORIES[safeCategory]

  const embed = new EmbedBuilder()
    .setTitle(`${categoryData.label} — Aide du bot Arcane`)
    .setColor(categoryData.color)
    .setTimestamp()

  if (safeCategory === "accueil") {
    embed.setDescription(
      "Bienvenue dans l'aide du bot **Arcane RP**.\n\n" +
      "Le bot est organisé autour de plusieurs systèmes : personnages RP, relations, collection de cartes, boutique, combats, échanges et commandes admin.\n\n" +
      "Utilise les boutons ci-dessous pour naviguer entre les catégories."
    )

    embed.addFields(
      {
        name: "👤 Personnages",
        value: "`/create`, `/profil`, `/editperso`, `/deleteperso`, `/image`, `/relation`",
        inline: false,
      },
      {
        name: "🎴 Gacha / Collection",
        value: "`/tirage`, `/collection`, `/cartes`, `/renseignement`, `/recycler`, `/echange`",
        inline: false,
      },
      {
        name: "🛒 Économie",
        value: "`/boutique`, `/inventaire`, `/profilcollection`, `/cosmetique`, `/favori`",
        inline: false,
      },
      {
        name: "⚔️ Combat",
        value: "`/statscarte`, `/combat pve`, `/combat pvp`, `/classement`",
        inline: false,
      }
    )
  }

  if (safeCategory === "personnage") {
    embed.setDescription("Commandes liées aux personnages RP.")

    embed.addFields(
      {
        name: "/create",
        value: "Créer un personnage RP.",
        inline: false,
      },
      {
        name: "/profil",
        value: "Afficher le profil d’un personnage. Le profil affiche aussi la popularité et les relations.",
        inline: false,
      },
      {
        name: "/editperso",
        value: "Modifier les informations d’un personnage.",
        inline: false,
      },
      {
        name: "/deleteperso",
        value: "Supprimer un personnage.",
        inline: false,
      },
      {
        name: "/image",
        value: "Modifier l’image d’un personnage.",
        inline: false,
      },
      {
        name: "/relation",
        value: "Créer, modifier ou supprimer des relations entre personnages.",
        inline: false,
      },
      {
        name: "/popularite",
        value: "Voter pour la popularité d’un personnage d’un autre joueur.",
        inline: false,
      }
    )
  }

  if (safeCategory === "gacha") {
    embed.setDescription("Commandes du système de cartes Arcane.")

    embed.addFields(
      {
        name: "/tirage",
        value:
          "Faire un tirage de 10 cartes.\n" +
          "Les nouvelles cartes sont ajoutées automatiquement à ta collection.\n" +
          "Les doublons sont convertis automatiquement en fragments.",
        inline: false,
      },
      {
        name: "/collection",
        value: "Voir les cartes que tu possèdes.",
        inline: false,
      },
      {
        name: "/cartes",
        value: "Voir toutes les cartes disponibles dans le bot avec image, description, rareté et ID.",
        inline: false,
      },
      {
        name: "/renseignement",
        value: "Voir les informations détaillées d’une carte précise.",
        inline: false,
      },
      {
        name: "/recycler",
        value: "Recycler d’anciens doublons contre des fragments.",
        inline: false,
      },
      {
        name: "/echange carte",
        value: "Proposer un échange carte contre carte à un autre joueur.",
        inline: false,
      },
      {
        name: "/echange fragments",
        value: "Proposer une carte contre des fragments.",
        inline: false,
      }
    )
  }

  if (safeCategory === "boutique") {
    embed.setDescription("Commandes liées aux fragments, boosts, objets et cosmétiques.")

    embed.addFields(
      {
        name: "/boutique",
        value:
          "Ouvrir la boutique.\n\n" +
          "Catégories disponibles :\n" +
          "🎁 Packs\n" +
          "⏳ Recharges\n" +
          "🍀 Boosts\n" +
          "🛡️ Protections\n" +
          "⚙️ Améliorations\n" +
          "🎖️ Cosmétiques\n" +
          "📌 Effets actifs",
        inline: false,
      },
      {
        name: "/inventaire",
        value: "Voir tes fragments, effets actifs, objets, cosmétiques, cartes et statistiques de combat.",
        inline: false,
      },
      {
        name: "/profilcollection",
        value: "Voir ton profil collectionneur ou celui d’un autre joueur.",
        inline: false,
      },
      {
        name: "/cosmetique voir",
        value: "Voir tes titres et badges achetés.",
        inline: false,
      },
      {
        name: "/cosmetique titre",
        value: "Choisir ton titre actif.",
        inline: false,
      },
      {
        name: "/cosmetique badge",
        value: "Choisir ton badge actif.",
        inline: false,
      },
      {
        name: "/favori carte",
        value: "Définir une carte favorite à afficher dans ton profil collectionneur.",
        inline: false,
      },
      {
        name: "/favori retirer",
        value: "Retirer ta carte favorite.",
        inline: false,
      }
    )
  }

  if (safeCategory === "combat") {
    embed.setDescription("Commandes liées aux combats de cartes.")

    embed.addFields(
      {
        name: "/statscarte",
        value: "Voir les statistiques de combat d’une carte : PV, attaque, défense, vitesse et puissance.",
        inline: false,
      },
      {
        name: "/combat pve",
        value:
          "Combattre un ennemi généré par le bot avec une carte que tu possèdes.\n" +
          "Une victoire rapporte des fragments.\n" +
          "Une défaite peut faire perdre des fragments, sauf si tu as une protection active.",
        inline: false,
      },
      {
        name: "/combat pvp",
        value:
          "Défier un autre joueur en combat de cartes.\n" +
          "Le gagnant peut voler des fragments au perdant.\n" +
          "Les protections PVP et boucliers économiques peuvent empêcher la perte.",
        inline: false,
      },
      {
        name: "/classement",
        value:
          "Afficher les classements du mini-jeu.\n\n" +
          "Classements disponibles : valeur, cartes, uniques, mythiques, fragments, victoires PVE, défaites PVE, victoires PVP, défaites PVP, victoires totales, défaites totales, fragments gagnés/perdus en combat.",
        inline: false,
      }
    )
  }

  if (safeCategory === "collection") {
    embed.setDescription("Commandes utiles pour progresser dans la collection.")

    embed.addFields(
      {
        name: "🎴 Obtenir des cartes",
        value:
          "`/tirage`\n" +
          "`/boutique categorie:Packs`\n" +
          "`/echange carte`\n" +
          "`/echange fragments`",
        inline: false,
      },
      {
        name: "💠 Obtenir des fragments",
        value:
          "Les fragments peuvent être obtenus avec :\n" +
          "les doublons de tirage, les combats PVE, les combats PVP, le recyclage et les échanges.",
        inline: false,
      },
      {
        name: "🍀 Utiliser des boosts",
        value:
          "Les boosts achetés dans `/boutique` sont visibles dans `/inventaire`.\n" +
          "Certains boosts sont consommés automatiquement lors du prochain tirage ou combat.",
        inline: false,
      },
      {
        name: "🎖️ Personnaliser son profil",
        value:
          "Achète des titres et badges dans `/boutique`, puis active-les avec `/cosmetique`.\n" +
          "Choisis aussi une carte favorite avec `/favori`.",
        inline: false,
      }
    )
  }

  if (safeCategory === "admin") {
    embed.setDescription("Commandes réservées à l’administration du serveur.")

    embed.addFields(
      {
        name: "/setlogs",
        value: "Définir le salon où envoyer les logs du serveur.",
        inline: false,
      },
      {
        name: "/admincollection voir-cartes",
        value: "Voir toutes les cartes disponibles dans le bot avec leur ID.",
        inline: false,
      },
      {
        name: "/admincollection voir-joueur",
        value: "Voir les cartes et fragments d’un joueur.",
        inline: false,
      },
      {
        name: "/admincollection ajouter-carte",
        value: "Ajouter une carte à l’inventaire d’un joueur.",
        inline: false,
      },
      {
        name: "/admincollection supprimer-carte",
        value: "Supprimer une carte de l’inventaire d’un joueur.",
        inline: false,
      },
      {
        name: "/admincollection ajouter-points",
        value: "Ajouter des fragments à un joueur.",
        inline: false,
      },
      {
        name: "/admincollection retirer-points",
        value: "Retirer des fragments à un joueur.",
        inline: false,
      },
      {
        name: "/admincollection reset",
        value: "Réinitialiser toutes les cartes et fragments d’un joueur.",
        inline: false,
      }
    )
  }

  embed.setFooter({
    text: "Arcane RP — Système de personnages, cartes, boutique et combats",
  })

  return embed
}

function buildHelpButtons(activeCategory, userId) {
  const rows = []

  const firstRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:category:accueil:${userId}`)
      .setLabel("🏠 Accueil")
      .setStyle(activeCategory === "accueil" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "accueil"),

    new ButtonBuilder()
      .setCustomId(`help:category:personnage:${userId}`)
      .setLabel("👤 Personnages")
      .setStyle(activeCategory === "personnage" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "personnage"),

    new ButtonBuilder()
      .setCustomId(`help:category:gacha:${userId}`)
      .setLabel("🎴 Gacha")
      .setStyle(activeCategory === "gacha" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "gacha"),

    new ButtonBuilder()
      .setCustomId(`help:category:boutique:${userId}`)
      .setLabel("🛒 Boutique")
      .setStyle(activeCategory === "boutique" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "boutique")
  )

  const secondRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:category:combat:${userId}`)
      .setLabel("⚔️ Combat")
      .setStyle(activeCategory === "combat" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "combat"),

    new ButtonBuilder()
      .setCustomId(`help:category:collection:${userId}`)
      .setLabel("📘 Collection")
      .setStyle(activeCategory === "collection" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "collection"),

    new ButtonBuilder()
      .setCustomId(`help:category:admin:${userId}`)
      .setLabel("🛠️ Admin")
      .setStyle(activeCategory === "admin" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeCategory === "admin")
  )

  rows.push(firstRow, secondRow)

  return rows
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Afficher l'aide du bot Arcane"),

  async execute(interaction) {
    const category = "accueil"
    const embed = buildHelpEmbed(category)
    const components = buildHelpButtons(category, interaction.user.id)

    return interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    })
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("help:")) return

    const parts = interaction.customId.split(":")
    const action = parts[1]
    const category = parts[2]
    const userId = parts[3]

    if (action !== "category") return

    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ Tu ne peux pas utiliser le menu d'aide d'un autre joueur.",
        ephemeral: true,
      })
    }

    const safeCategory = HELP_CATEGORIES[category] ? category : "accueil"
    const embed = buildHelpEmbed(safeCategory)
    const components = buildHelpButtons(safeCategory, interaction.user.id)

    return interaction.update({
      embeds: [embed],
      components,
    })
  },
}