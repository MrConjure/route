const Route = require('../../../../../')

const r = new Route()

r.push(async (req, res) => {
  res.send('GET 2')
})

module.exports = r
