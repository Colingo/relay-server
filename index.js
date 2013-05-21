var http = require("http")
var net = require("net")
var url = require("url")
var Buffer = require("buffer").Buffer

var Router = require("routes")
var sendError = require("send-data/error")
var after = require("after")
var split = require("split")
var EngineServer = require("engine.io").Server
var WebSocketStream = require("websocket-stream")

var shoe = require("./lib/patched-shoe")
var TimePurgedQueue = require("./lib/time-purged-queue")

module.exports = RelayServer

/*
    type RouteHandler := (req, res, { params, splats }, Callback<{
        method: String,
        uri: String,
        body: Any
    }>)

    RelayServer := (routes: Object<String, RouteHandler>, options: {
        notFound: (req, res) => void,
        errorHandler: (req, res) => void,
        tcp: Boolean,
        sockJS: Boolean,
        engineIO: Boolean,
        sharedHttp: Boolean
    }) => { http: HttpServer, tcp: NetServer }
*/
function RelayServer(routes, options) {
    options = options || {}
    var timeToLive = options.timeToLive || 20 * 1000
    var sharedHttp = options.sharedHttp || false
    var tcp = options.tcp || false
    var sockJS = options.sockJS || false
    var engineIO = options.engineIO || true

    var sockets = []
    var history = TimePurgedQueue(timeToLive)

    var relayHandler = RelayRequestHandler(routes, options, relayMessage)
    var readHttpServer = http.createServer()
    var writeHttpServer = !sharedHttp ? http.createServer() : null

    var tcpServer = tcp ? createTCPServer(socketListener, relayMessage) : null
    var sockHandler = sockJS ? createSockHandler(socketListener) : null
    var engineServer = engineIO ? createEngineServer(socketListener) : null

    readHttpServer.on("request", function onRequest(req, res) {
        var uri = url.parse(req.url).pathname

        if (sockHandler && uri.substr(0, 5) === "/shoe") {
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
        http: {
            read: readHttpServer,
            write: writeHttpServer,
            server: readHttpServer
        },
        tcp: tcpServer,
        close: close,
        _sockets: sockets,
        _history: history
    }

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
        var closeCount = 1

        if (!sharedHttp) {
            closeCount++
        }
        if (tcpServer) {
            closeCount++
        }

        var forward = after(closeCount, callback)

        history.destroy()
        readHttpServer.close(forward)

        if (tcpServer) {
            tcpServer.close(forward)
        }
        if (!sharedHttp) {
            writeHttpServer.close(forward)
        }
        if (engineServer) {
            engineServer.close()
        }
    }
}

function createEngineServer(socketListener) {
    var engineServer = new EngineServer()

    engineServer.on("connection", function engineHandler(socket) {
        var stream = WebSocketStream(socket)
        stream.uri = socket.request.url

        socketListener(stream)
    })

    return engineServer
}

function createSockHandler(socketListener) {
    var sock = shoe(function sockHandler(socket) {
        socket.uri = socket.url
        socketListener(socket)
    })
    var sockHandler = sock.listener({ prefix: "/shoe" }).getHandler()

    return sockHandler
}

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

function RelayMessage(uri, verb, body) {
    this.uri = uri
    this.verb = verb
    this.body = body
}

function SocketMessage(socket, uri, metaRegexp) {
    this.socket = socket
    this.uri = uri
    this.regexp = metaRegexp
}


function RelayRequestHandler(routes, options, relayMessage) {
    var notFound = options.notFound || fourofour
    var errorHandler = options.errorHandler || sendError

    var router = Router()

    Object.keys(routes).forEach(function (route) {
        var handler = routes[route]

        router.addRoute(route, handler)
    })

    return requestHandler

    function requestHandler(req, res) {
        var route = router.match(url.parse(req.url).pathname)

        if (!route) {
            return notFound(req, res)
        }

        var fn = route.fn
        fn(req, res, new RequestOptions(route.params, route.splats),
            function (err, message) {
                if (err) {
                    return errorHandler(req, res, err)
                }

                if (!message) {
                    return
                }

                if (typeof message.uri === "string" &&
                    typeof message.verb === "string" &&
                    "body" in message
                ) {
                    relayMessage(new RelayMessage(message.uri,
                        message.verb, message.body))
                }
            })
    }
}

function RequestOptions(params, splats) {
    this.params = params || null
    this.splats = splats || null
}

function fourofour(req, res) {
    res.statusCode = 404
    res.end("404 Not Found")
}
