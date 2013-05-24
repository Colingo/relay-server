module.exports = RelayMessage

function RelayMessage(uri, verb, body) {
    this.uri = uri
    this.verb = verb
    this.body = body
}
