var console = require("console")
var Buffer = require("buffer").Buffer
var Router = require("routes")

var RequestOptions = require("../messages/request-options")
var validMessage = require("../messages/valid-message")

module.exports = SocketListener

function SocketListener(sockets, options) {
    var readRoutes = options.readRoutes || {}
    var router = Router()

    Object.keys(readRoutes).forEach(function (route) {
        router.addRoute(route, readRoutes[route])
    })

    return socketListener

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
    function socketListener(socket, request) {
        var uri = socket.uri
        var socketMessage = new SocketMessage(socket, uri)

        sockets.push(socketMessage)

        socket.once("close", function closeHandler() {
            for (var i = 0; i < sockets.length; i++) {
                var tuple = sockets[i]
                if (tuple[0] === socket) {
                    sockets.splice(i, 1)
                    break
                }
            }
        })

        var route = router.match(uri)

        if (!route) {
            socketMessage.loading = false
            return
        }

        var fn = route.fn
        fn(request, uri, new RequestOptions(route.params, route.splats),
            function writeMessage(err, message) {
                if (err) {
                    // BLARGH
                    console.error("relay-server:: error", err)
                    socket.end()

                    if (socket.destroy) {
                        socket.destroy()
                    }

                    return
                }

                if (validMessage(message)) {
                    var buffer = new Buffer(JSON.stringify(message) + "\n")
                    socket.write(buffer)
                }

                socketMessage.loading = false

                var queue = socketMessage.queue
                for (var i = 0; i < queue.length; i++) {
                    socket.write(queue[i])
                }
                queue.length = 0
            })
    }
}

function SocketMessage(socket, uri) {
    this.socket = socket
    this.uri = uri
    this.regexp = Router.pathToRegExp(uri)
    this.loading = true
    this.queue = []
}
