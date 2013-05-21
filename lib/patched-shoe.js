var shoe = require("shoe")

module.exports = PatchedShoe

function PatchedShoe(opts, callback) {
    if (typeof opts === "function") {
        callback = opts
        opts = {}
    }

    var sock = shoe(opts, function listener(stream) {
        var _didTimeout = stream._session.didTimeout
        var _didClose = stream._session.didClose

        stream._session.didTimeout = function () {
            cleanup()
            _didTimeout.apply(this, arguments)
        }
        stream._session.didClose = function () {
            cleanup()
            _didClose.apply(this, arguments)
        }

        callback(stream)

        function cleanup() {
            if (stream.destroy) {
                stream.destroy()
            } else {
                stream.emit("close")
            }
        }
    })

    return sock
}
