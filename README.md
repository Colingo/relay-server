# relay-server

[![build status][1]][2] [![dependency status][3]][4]

<!-- [![browser support][5]][6] -->

Server used to relay deltas

## Example

```js
// Configure a server that takes arbitrary incoming messages and
// accepts them
var servers = RelayServer({
    // writeRoutes is where you configure how to handle incoming
    // requests to the write http server. You should
    // sanitize, authorize and validate the incoming message
    // and then return a triplet of { uri, verb, body }
    writeRoutes: {
        "/*": function acceptEverything(req, res, opts, callback) {
            var pathname = url.parse(req.url).pathname
            jsonBody(req, res, function (err, body) {
                if (err) {
                    return callback(err)
                }

                callback(null, { uri: pathname, verb: req.method, body: body })
                sendJson(req, res, "ok")
            })
        }
    },
    // readRoutes is where you configure how to read a consistent
    // state for a given uri. This will be the first value
    // flushed down the streaming connection followed by individual
    // messages
    readRoutes: {
        "/*": function returnNothing(req, pathname, opts, callback) {
            callback(null, {
                uri: pathname,
                verb: "PATCH",
                body: {}
            })
        }
    },
    sharedHttp: true, // use a single HTTP server for write & read
    tcp: true // create a TCP server for write & read
})

servers.http.server.listen(8000)
server.tcp.listen(8001)
```

## Benchmarks

There is a benchmark for the memory usage of the relay-server

There is also a benchmark for the CPU usaged of the relay mechanism
  using plain TCP. They are locationed in ./benchmarks/plain-tcp

On my machine the following

 - [`node benchmarks/plain-tcp/server.js`][5]
 - [`node benchmarks/plain-tcp/clients.js --clients=100`][6]

Print out that the server uses roughly 30% CPU & 20MB and the
  client uses 40$ CPU & 10MB

As can be seen the memory usage of this relaying is completely
  flat. However the CPU usage seems really high.

### Improvements (soon)

 - I have yet to figure out why the CPU usage is high

## Installation

`npm install relay-server`

## Contributors

 - Raynos

## MIT Licenced

  [1]: https://secure.travis-ci.org/Colingo/relay-server.png
  [2]: http://travis-ci.org/Colingo/relay-server
  [3]: https://david-dm.org/Colingo/relay-server/status.png
  [4]: https://david-dm.org/Colingo/relay-server
  [5]: https://github.com/Colingo/relay-server/blob/master/benchmarks/plain-tcp/server.js
  [6]: https://github.com/Colingo/relay-server/blob/master/benchmarks/plain-tcp/clients.js

