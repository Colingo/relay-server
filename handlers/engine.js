var EngineServer = require("engine.io").Server
var WebSocketStream = require("websocket-stream")

module.exports = createEngineServer

function createEngineServer(socketListener) {
    var engineServer = new EngineServer()

    engineServer.on("connection", function engineHandler(socket) {
        var stream = WebSocketStream(socket)
        stream.uri = socket.request.url

        socketListener(stream)
    })

    return engineServer
}
