var url = require("url")
var http = require("http")
var after = require("after")

var RelayRequestHandler = require("./relay-http-write")
var createSockHandler = require("./sock")
var createEngineServer = require("./engine")

module.exports = createHttpServers

function createHttpServers(options, socketListener, relayMessage) {
    var sharedHttp = options.sharedHttp
    var sockJS = options.sockJS
    var engineIO = options.engineIO

    var relayHandler = RelayRequestHandler(options, relayMessage)
    var writeHttpServer = !sharedHttp ? http.createServer() : null
    var sockHandler = sockJS ? createSockHandler(socketListener) : null
    var engineServer = engineIO ? createEngineServer(socketListener) : null

    var readHttpServer = http.createServer()

    readHttpServer.on("request", function onRequest(req, res) {
        var uri = url.parse(req.url).pathname

        if (sockHandler && uri.substr(0, 5) === "/shoe") {
            res.request = req
            sockHandler(req, res)
        } else if (engineServer && uri.substr(0, 7) === "/engine") {
            engineServer.handleRequest(req, res)
        } else if (sharedHttp) {
            relayHandler(req, res)
        }
    })

    readHttpServer.on("upgrade", function onUpgrade(req, socket, head) {
        var uri = url.parse(req.url).pathname
        if (sockHandler && uri.substr(0, 5) === "/shoe") {
            sockHandler(req, socket, head)
        } else if (engineServer && uri.substr(0, 7) === "/engine") {
            engineServer.handleUpgrade(req, socket, head)
        }
    })

    if (!sharedHttp) {
        writeHttpServer.on("request", relayHandler)
    }

    return {
        write: writeHttpServer,
        read: readHttpServer,
        server: readHttpServer,
        close: close
    }

    function close(callback) {
        var forward = after(sharedHttp ? 1 : 2, callback)

        readHttpServer.close(forward)

        if (!sharedHttp) {
            writeHttpServer.close(forward)
        }
        if (engineServer) {
            engineServer.close()
        }
    }
}
