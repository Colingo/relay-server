var url = require("url")
var shoe = require("../lib/patched-shoe")

module.exports = createSockHandler

function createSockHandler(socketListener) {
    var sock = shoe(function sockHandler(socket) {
        socket.uri = url.parse(socket.url, true).query.uri

        socketListener(socket, socket)
    })
    var sockHandler = sock.listener({ prefix: "/shoe" }).getHandler()

    return sockHandler
}
