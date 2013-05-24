var net = require("net")
var split = require("split")

var RelayMessage = require("../messages/relay-message")
var validMessage = require("../messages/valid-message")

module.exports = createTCPServer

function createTCPServer(socketListener, relayMessage) {
    return net.createServer(function netHandler(socket) {
        var splitted = socket.pipe(split())

        splitted.once("data", function headerHandler(chunk) {
            var meta = JSON.parse(chunk)

            if (meta.uri) {
                socket.uri = meta.uri
                socketListener(socket, socket)
            }

            splitted.on("data", relay)
        })
    })

    function relay(chunk) {
        if (chunk) {
            var message = JSON.parse(chunk)

            if (validMessage(message)) {
                relayMessage(new RelayMessage(message.uri,
                    message.verb, message.body))
            }
        }
    }
}
