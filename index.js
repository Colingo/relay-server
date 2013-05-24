var Buffer = require("buffer").Buffer
var after = require("after")
var extend = require("xtend")

var createTCPServer = require("./handlers/tcp")
var createHttpServers = require("./handlers/http")
var SocketListener = require("./handlers/socket-listener")

var defaults = {
    tcp: false,
    sockJS: false,
    engineIO: true,
    writeRoutes: {},
    sharedHttp: false,
    timeToLive: 20 * 1000
}

module.exports = RelayServer

/*
    type WriteRouteHandler := (req, res, { params, splats }, Callback<{
        verb: String,
        uri: String,
        body: Any
    }>)

    type ReadRouteHandler := (req, String, { params: splats }, Callback<{
        verb: String,
        uri: String,
        body: Any
    })

    RelayServer := (options: {
        notFound: (req, res) => void,
        errorHandler: (req, res) => void,
        timeToLive: Number,
        tcp: Boolean,
        sockJS: Boolean,
        writeRoutes: Object<String, WriteRouteHandler>,
        readRoutes: Object<String, ReadRouteHandler>,
        engineIO: Boolean,
        sharedHttp: Boolean
    }) => {
        http: {
            read: HttpServer,
            write: HttpServer,
            server: HttpServer
        },
        tcp: NetServer,
        close: (Callback) => void
    }

    options default to {
        notFound: null,
        errorHandler: null,
        timeToLive: 20000,
        writeRoutes: {},
        tcp: false,
        sockJS: false,
        engineIO: true,
        sharedHttp: false
    }

    which means create two HTTP servers one for writing messages
        to and one for relaying messages over engine.io
*/
function RelayServer(options) {
    options = extend(defaults, options || {})

    var sockets = []
    var relayMessage = MessageRelay(sockets)
    var socketListener = SocketListener(sockets, options)

    var tcpServer = options.tcp ?
        createTCPServer(socketListener, relayMessage) : null
    var httpServers = createHttpServers(options, socketListener,
        relayMessage)

    return {
        http: httpServers,
        tcp: tcpServer,
        close: close,
        _sockets: sockets
    }

    function close(callback) {
        var forward = after(tcpServer ? 2 : 1, callback)

        httpServers.close(forward)

        if (tcpServer) {
            tcpServer.close(forward)
        }
    }
}

function MessageRelay(sockets) {
    return relayMessage

    /*  relayMessage := (message: {
            verb: String,
            uri: String,
            body: Any
        }) => void

        relayMessage will send it to all open sockets.
            Sockets are Streams that may be either TCP,
            SockJS or engineIO clients
    */
    function relayMessage(message) {
        var buffer = new Buffer(JSON.stringify(message) + "\n")

        for (var i = 0; i < sockets.length; i++) {
            var socketMessage = sockets[i]
            var regexp = socketMessage.regexp
            var socket = socketMessage.socket

            if (regexp.test(message.uri)) {
                if (socketMessage.loading) {
                    socketMessage.queue.push(buffer)
                } else {
                    socket.write(buffer)
                }
            }
        }
    }
}
