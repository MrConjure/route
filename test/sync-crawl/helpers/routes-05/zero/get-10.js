const Route = require('../../../../../')

const r = new Route()

r.push((req, res) => {
  res.send('TEN')
})

module.exports = r
