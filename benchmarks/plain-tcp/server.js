var net = require("net")
var argv = require("optimist").argv
var setTimeout = require("timers").setTimeout
var Buffer = require("buffer").Buffer

var buffered = argv.buffered

// Create TCP server
//
// Each connection gets stored in an array
// Every message written to the socket gets rewritten to all
// connected sockets
//
var server = (function () {
    var sockets = []

    var server = net.createServer(function (socket) {
        sockets.push(socket)

        var relayer = buffered ? BufferedRelay(sockets) :
            StandardRelay(sockets)

        socket.on("data", relayer)

        socket.once("close", function () {
            sockets.splice(sockets.indexOf(socket), 1)
        })
    })

    return server
}())

// The standard way to forward data to other sockets is to just
// write it
function StandardRelay(sockets) {
    return function ondata(chunk) {
        for (var i = 0; i < sockets.length; i++) {
            sockets[i].write(chunk)
        }
    }
}

// Instead of writing each message immediately we buffer up
// messages into a larger buffer and send it at once after 50ms
function BufferedRelay(sockets) {
    var chunks = []

    return function ondata(chunk) {
        if (chunks.length === 0) {
            chunks.push(chunk)

            setTimeout(function () {
                var allChunks = Buffer.concat(chunks)

                for (var i = 0; i < sockets.length; i++) {
                    sockets[i].write(allChunks)
                }

                chunks.length = 0
            }, 50)
        } else {
            chunks.push(chunk)
        }
    }
}

var TCP_PORT = 10251

server.listen(TCP_PORT)

var strategy = buffered ? "buffered relay" : "plain relay"

console.log("running on port", 10251, "using strategy", strategy)

require("../print-stats")
