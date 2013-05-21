var net = require("net")
var uuid = require("uuid")
var setInterval = require("timers").setInterval
var setTimeout = require("timers").setTimeout
var split = require("split")
var console = require("console")
var argv = require("optimist").argv
var fs = require("fs")

var RelayServer = require("../index")

var HTTP_PORT = Math.round(Math.random() * 10000) + 2000
var TCP_PORT = Math.round(Math.random() * 10000) + 2000
var servers = RelayServer({}, {
    timeToLive: 500,
    sharedHttp: true,
    tcp: true
})

servers.http.server.listen(HTTP_PORT)
servers.tcp.listen(TCP_PORT)

var rate = argv.rate || 5
var volume = argv.volume || 1
var clients = argv.clients || 1

var volumeCheck = rate * volume * clients

var list = []
for (var i = 0; i < clients; i++) {
    list[i] = i
}


list.forEach(function (index) {
    var lineCount = 0
    var client = net.connect(TCP_PORT, function () {
        client.write(JSON.stringify({ uri: "/*" }) + "\n")

        setInterval(function () {
            for (var i = 0; i < volume; i++) {
                client.write(JSON.stringify({
                    uri: "/" + uuid(),
                    verb: "POST",
                    body: { id: uuid() }
                }) + "\n")
            }
        }, 1000 / rate)
    })

    client.pipe(split()).on("data", function () {
        ++lineCount

        if ((lineCount % volumeCheck) === 0 && index === 0) {
            console.log("lineCount", lineCount)
        }
    })
})

setInterval(function () {
    var mems = process.memoryUsage()
    var mil = 1000 * 1000
    console.log("memory", {
        rss: Math.round(mems.rss / mil) + "MB",
        heapTotal: Math.round(mems.heapTotal / mil) + "MB",
        heapUsed: Math.round(mems.heapUsed / mil) + "MB",
    })

    getUsageDiff(function (err, percentage) {
        console.log("CPU percentage:", percentage)
    })
}, 1000)

var getUsage = function(cb){
    fs.readFile("/proc/" + process.pid + "/stat", function(err, data){
        var elems = data.toString().split(" ")
        var utime = +elems[13]
        var stime = +elems[14]

        cb(utime + stime);
    });
}

function getUsageDiff(callback) {
    getUsage(function (startTime) {
        setTimeout(function () {
            getUsage(function (endTime) {
                var delta = endTime - startTime
                var percentage = 10000 * (delta / 10000)

                callback(null, percentage)
            })
        }, 1000)
    })
}
