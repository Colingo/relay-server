var net = require("net")
var split = require("split")

var RelayMessage = require("../relay-message")

module.exports = createTCPServer

function createTCPServer(socketListener, relayMessage) {
    return net.createServer(function netHandler(socket) {
        var splitted = socket.pipe(split())

        splitted.once("data", function headerHandler(chunk) {
            var meta = JSON.parse(chunk)

            if (meta.uri) {
                socket.uri = "/?uri=" + meta.uri
                socketListener(socket)
            }

            splitted.on("data", relay)
        })
    })

    function relay(chunk) {
        if (chunk) {
            var message = JSON.parse(chunk)

            if (typeof message.uri === "string" &&
                typeof message.verb === "string" &&
                typeof message.body !== "undefined"
            ) {
                relayMessage(new RelayMessage(message.uri,
                    message.verb, message.body))
            }
        }
    }
}
