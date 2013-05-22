var net = require("net")
var argv = require("optimist").argv
var setInterval = require("timers").setInterval
var setTimeout = require("timers").setTimeout
var split = require("split")
var console = require("console")
var Buffer = require("buffer").Buffer

var b = new Buffer("lulz \n")


// We configure our clients to run ::
// rate -> The rate at which they send messages
// volume -> The amount of messages they send at every tick
// clients -> The amount of TCP clients opened
var rate = argv.rate || 1
var volume = argv.volume || 1
var clients = argv.clients || 50

var volumeCheck = rate * volume * clients

// Create a list of `clients` numbers
var list = []
for (var i = 0; i < clients; i++) {
    list[i] = i
}

var TCP_PORT = 10251

// for each index
list.forEach(function (index) {
    var lineCount = 0

    // create a client. Delay the execution of the periodic sending
    // so that they don't all send messages at roughly the same
    // time
    // Then get them to send a single buffer (containing a string)
    // `volume` amount of times
    var client = net.connect(TCP_PORT, function () {
        setTimeout(function () {
            setInterval(function () {
                for (var i = 0; i < volume; i++) {
                    client.write(b)
                }
            }, 1000 / rate)
        }, (1000 / clients) * index)
    })

    // the data is line seperated. So we use split to parse it
    // and then just log the lineCount when it reaches a certain
    // size
    client.pipe(split()).on("data", function () {
        ++lineCount

        if ((lineCount % volumeCheck) === 0 && index === 0) {
            console.log("lineCount", lineCount)
        }
    })
})

// print stats for this thing
console.log("RUNNING", {
    clients: clients,
    volume: volume,
    rate: rate
})

require("../print-stats")
