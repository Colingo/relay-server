var setInterval = require("timers").setInterval
var setTimeout = require("timers").setTimeout
var fs = require("fs")
var console = require("console")
var process = require("process")

// every second print memory usage. Memory does not leak
// Also peek in /proc/ and print the cpu usage
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
