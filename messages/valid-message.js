module.exports = validMessage

function validMessage(message) {
    return message && typeof message.uri === "string" &&
        typeof message.verb === "string" && "body" in message
}
