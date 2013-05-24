var url = require("url")
var net = require("net")

var request = require("request")
var test = require("tape")
var jsonBody = require("body/json")
var sendJson = require("send-data/json")
var uuid = require("uuid")
var split = require("split")
var WebSocket = require("ws")
var WebSocketStream = require("websocket-stream")
var EngineSocket = require("engine.io-client").Socket

var RelayServer = require("../index")

var HTTP_PORT = Math.round(Math.random() * 10000) + 2000
var TCP_PORT = Math.round(Math.random() * 10000) + 2000
var servers

test("RelayServer is a function", function (assert) {
    assert.equal(typeof RelayServer, "function")
    assert.end()
})

test("create server", function (assert) {
    servers = RelayServer({
        writeRoutes: {
            "/*": function acceptEverything(req, res, _, callback) {
                var pathname = url.parse(req.url).pathname
                jsonBody(req, res, function (err, body) {
                    if (err) {
                        return callback(err)
                    }

                    callback(null, {
                        uri: pathname,
                        verb: req.method,
                        body: body
                    })
                    sendJson(req, res, "OK")
                })
            }
        },
        readRoutes: {
            "/*": function returnNothing(req, pathname, _, callback) {
                callback(null, {
                    uri: pathname,
                    verb: "PATCH",
                    body: {}
                })
            }
        },
        sharedHttp: true,
        sockJS: true,
        tcp: true
    })

    assert.ok(servers)
    assert.equal(typeof servers.http.server.listen, "function")
    assert.equal(typeof servers.tcp.listen, "function")

    servers.http.server.listen(HTTP_PORT, function () {
        servers.tcp.listen(TCP_PORT, function () {
            assert.end()
        })
    })
})

function readTwo(socket, callback) {
    var counter = 2
    var results = []
    var splitted = socket.pipe(split())

    splitted.on("data", function (chunk) {
        if (chunk === "") {
            return
        }

        var json = JSON.parse(String(chunk))

        counter--
        results.push(json)

        if (counter === 0) {
            callback(null, results)
        }
    })
}

test("POST with open socket", function (assert) {
    var id = uuid()
    // open a TCP socket
    var client = net.connect(TCP_PORT, function () {
        // Write the header saying what uri's your interested in
        client.write(JSON.stringify({ uri: "/foo" }) + "\n")

        // make a RESTful request to add messages to the relay
        // server
        request({
            uri: "http://localhost:" + HTTP_PORT + "/foo",
            method: "POST",
            json: { id: id }
        }, function (err, res, body) {
            assert.ifError(err)
            assert.equal(res.statusCode, 200)
            assert.equal(body, "OK")
        })
    })

    readTwo(client, function (err, list) {
        assert.ifError(err)

        var first = list[0]

        assert.equal(first.uri, "/foo")
        assert.equal(first.verb, "PATCH")
        assert.deepEqual(first.body, {})

        var second = list[1]

        assert.equal(second.uri, "/foo")
        assert.equal(second.verb, "POST")
        assert.equal(second.body.id, id)

        client.end()
        assert.end()
    })
})

test("POST with open (websocket) sockJS socket", function (assert) {
    var id = uuid()

    var socket = new WebSocket("ws://localhost:" + HTTP_PORT +
        "/shoe/websocket?uri=/bar")
    var stream = WebSocketStream(socket)

    stream.on("open", function () {
        request({
            uri: "http://localhost:" + HTTP_PORT + "/bar",
            method: "POST",
            json: { id: id }
        }, function (err, res, body) {
            assert.ifError(err)
            assert.equal(res.statusCode, 200)
            assert.equal(body, "OK")
        })
    })

    readTwo(stream, function (err, list) {
        assert.ifError(err)

        var first = list[0]

        assert.equal(first.uri, "/bar")
        assert.equal(first.verb, "PATCH")
        assert.deepEqual(first.body, {})

        var second = list[1]

        assert.equal(second.uri, "/bar")
        assert.equal(second.verb, "POST")
        assert.equal(second.body.id, id)

        stream.end()
        assert.end()
    })
})

test("POST with open engine.io socket", function (assert) {
    var id = uuid()

    var socket = new EngineSocket("ws://localhost:" + HTTP_PORT, {
        transports: ["websocket"],
        query: { uri: "/baz" }
    })
    var stream = WebSocketStream(socket)

    stream.on("open", function () {
        request({
            uri: "http://localhost:" + HTTP_PORT + "/baz",
            method: "POST",
            json: { id: id }
        }, function (err, res, body) {
            assert.ifError(err)
            assert.equal(res.statusCode, 200)
            assert.equal(body, "OK")
        })
    })

    readTwo(stream, function (err, list) {
        assert.ifError(err)

        var first = list[0]

        assert.equal(first.uri, "/baz")
        assert.equal(first.verb, "PATCH")
        assert.deepEqual(first.body, {})

        var second = list[1]

        assert.equal(second.uri, "/baz")
        assert.equal(second.verb, "POST")
        assert.equal(second.body.id, id)

        stream.end()
        assert.end()
    })
})

test("write down socket with open socket", function (assert) {
    var id = uuid()

    var client = net.connect(TCP_PORT, function () {
        // Write the header saying what uri's your interested in
        client.write(JSON.stringify({ uri: "/quux" }) + "\n")

        // make a RESTful request to add messages to the relay
        // server
        client.write(JSON.stringify({
            uri: "/quux",
            verb: "POST",
            body: { id: id }
        }) + "\n")
    })

    readTwo(client, function (err, list) {
        assert.ifError(err)

        var first = list[0]

        assert.equal(first.uri, "/quux")
        assert.equal(first.verb, "PATCH")
        assert.deepEqual(first.body, {})

        var second = list[1]

        assert.equal(second.uri, "/quux")
        assert.equal(second.verb, "POST")
        assert.equal(second.body.id, id)

        client.end()
        assert.end()
    })
})

test("close servers", function (assert) {
    servers.close(function (err) {
        assert.ifError(err)

        assert.end()
    })
})
