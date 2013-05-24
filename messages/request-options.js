module.exports = RequestOptions

function RequestOptions(params, splats) {
    this.params = params || null
    this.splats = splats || null
}
