var url = require("url")
var Buffer = require("buffer").Buffer

var Router = require("routes")
var after = require("after")
var extend = require("xtend")

var TimePurgedQueue = require("./lib/time-purged-queue")
var createTCPServer = require("./handlers/tcp")
var createHttpServers = require("./handlers/http")

var defaults = {
    tcp: false,
    sockJS: false,
    engineIO: true,
    sharedHttp: false,
    timeToLive: 20 * 1000
}

module.exports = RelayServer

/*
    type RouteHandler := (req, res, { params, splats }, Callback<{
        verb: String,
        uri: String,
        body: Any
    }>)

    RelayServer := (routes: Object<String, RouteHandler>, options: {
        notFound: (req, res) => void,
        errorHandler: (req, res) => void,
        timeToLive: Number,
        tcp: Boolean,
        sockJS: Boolean,
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
        tcp: false,
        sockJS: false,
        engineIO: true,
        sharedHttp: false
    }

    which means create two HTTP servers one for writing messages
        to and one for relaying messages over engine.io
*/
function RelayServer(routes, options) {
    options = extend(defaults, options || {})
    options.routes = routes

    var sockets = []
    var history = TimePurgedQueue(options.timeToLive)

    var tcpServer = options.tcp ?
        createTCPServer(socketListener, relayMessage) : null
    var httpServers = createHttpServers(options, socketListener, relayMessage)

    return {
        http: httpServers,
        tcp: tcpServer,
        close: close,
        _sockets: sockets,
        _history: history
    }

    /*  relayMessage := (message: {
            verb: String,
            uri: String,
            body: Any
        }) => void

        relayMessage will store the message in the history and send it to
            all open sockets. Sockets are Streams that may be either TCP,
            sockJS or engineIO clients
    */
    function relayMessage(message) {
        var buffer = new Buffer(JSON.stringify(message) + "\n")
        history.add(message, buffer)

        for (var i = 0; i < sockets.length; i++) {
            var socketMessage = sockets[i]
            var regexp = socketMessage.regexp
            var socket = socketMessage.socket

            if (regexp.test(message.uri)) {
                socket.write(buffer)
            }
        }
    }

    /*  socketListener := (socket: Stream & { uri: String }) => void

        socketListener takes a socket which is a writable stream with
            an uri property. The uri property should be a pathname
            with a query parameter `uri` which describes a valid
            `routes` string pattern to be used to filter the relay
            messages.

        It will flush the history into this socket and then store the
            socket in the sockets array and relayMessage will write any
            real time `RelayMessage`'s to this socket.
    */
    function socketListener(socket) {
        var metaUri = url.parse(socket.uri, true).query.uri

        var metaRegexp = Router.pathToRegExp(metaUri)
        sockets.push(new SocketMessage(socket, metaUri, metaRegexp))

        var queue = history.queue

        for (var i = 0; i < queue.length; i++) {
            var tuple = queue[i]
            var value = tuple.value

            if (metaRegexp.test(value.uri)) {
                socket.write(tuple.buffer)
            }
        }

        socket.once("close", function closeHandler() {
            for (var i = 0; i < sockets.length; i++) {
                var tuple = sockets[i]
                if (tuple[0] === socket) {
                    sockets.splice(i, 1)
                    break
                }
            }
        })
    }

    function close(callback) {
        var forward = after(tcpServer ? 2 : 1, callback)

        history.destroy()
        httpServers.close(forward)

        if (tcpServer) {
            tcpServer.close(forward)
        }
    }
}

function SocketMessage(socket, uri, metaRegexp) {
    this.socket = socket
    this.uri = uri
    this.regexp = metaRegexp
}
