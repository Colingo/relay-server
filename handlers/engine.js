var url = require("url")
var EngineServer = require("engine.io").Server
var WebSocketStream = require("websocket-stream")

module.exports = createEngineServer

function createEngineServer(socketListener) {
    var engineServer = new EngineServer()

    engineServer.on("connection", function engineHandler(socket) {
        var stream = WebSocketStream(socket)
        stream.uri = url.parse(socket.request.url, true).query.uri

        socketListener(stream, socket.request)
    })

    return engineServer
}
