var shoe = require("../lib/patched-shoe")

module.exports = createSockHandler

function createSockHandler(socketListener) {
    var sock = shoe(function sockHandler(socket) {
        socket.uri = socket.url
        socketListener(socket)
    })
    var sockHandler = sock.listener({ prefix: "/shoe" }).getHandler()

    return sockHandler
}
