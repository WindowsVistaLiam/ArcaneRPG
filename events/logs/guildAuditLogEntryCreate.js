const { sendLog } = require("../../utils/sendLog")

module.exports = {
    name: "guildAuditLogEntryCreate",

    async execute(auditLogEntry, guild, client) {
        const executor = auditLogEntry.executor
        const target = auditLogEntry.target

        await sendLog(client, guild.id, {
            title: "Action admin / audit log",
            color: 0x9b59b6,
            fields: [
                {
                    name: "Action",
                    value: String(auditLogEntry.action),
                    inline: true
                },
                {
                    name: "Auteur",
                    value: executor
                        ? `${executor.tag} (${executor.id})`
                        : "Inconnu",
                    inline: false
                },
                {
                    name: "Cible",
                    value: target
                        ? `${target.tag || target.name || target.id || "Cible inconnue"}`
                        : "Aucune cible",
                    inline: false
                },
                {
                    name: "Raison",
                    value: auditLogEntry.reason || "Aucune raison",
                    inline: false
                }
            ]
        })
    }
}