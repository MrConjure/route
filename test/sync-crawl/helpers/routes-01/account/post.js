const Route = require('../../../../../')

const r = new Route()

r.push((req, res) => {
  res.send('POST 2')
})

module.exports = r
