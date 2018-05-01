/*eslint no-sync: 0*/

const fs = require('fs')
const path = require('path')
const sortInsensitive = require('@conjurelabs/utils/Array/sort-insensitive')

const validVerbs = ['all', 'get', 'post', 'put', 'patch', 'delete']
const startingDollarSign = /^\$/
const jsFileExt = /\.js$/
const validFilename = /-\d+?$/

function syncCrawlRoutesDir(rootpath) {
  let firstCrawl = true

  function getRoutes(dirpath, uriPathTokens = []) {
    const base = path.parse(dirpath).base

    // first directory is not added to the uri path, for the express routing
    if (firstCrawl === false) {
      // adding to the tokens of the express route, based on the current directory being crawled
      // a folder starting with a $ will be considered a req param
      // (The : used in express does not work well in directory naming, and will mess up directory searching)
      uriPathTokens.push(base.replace(startingDollarSign, ':'))
    } else {
      firstCrawl = false
    }

    const list = fs.readdirSync(dirpath)
    const subDirectories = []
    const paramDirectories = []
    const routes = []
    let files = []

    sortInsensitive(list)

    for (let resource of list) {
      const stat = fs.statSync(path.resolve(dirpath, resource))

      if (stat.isFile() && jsFileExt.test(resource)) {
        files.push(resource)
        continue
      }

      if (stat.isDirectory()) {
        if (startingDollarSign.test(resource)) {
          paramDirectories.push(resource)
          continue
        }

        subDirectories.push(resource)
      }
    }

    /*
      Example input:
      [
        'get.js',
        'GET-99.js',
        'other.js',
        'README.md'
      ]

      Example output:
      [
        { verb: 'get', order: NaN, filename: 'get.js', routeInstance: {...} },
        { verb: 'get', order: 99, filename: 'GET-99.js', routeInstance: {...} }
      ]
    */
    files = files
      .map(filename => {
        const tokens = filename.match(/^([a-zA-Z]+)-?(\d*)\.js/)

        if (!tokens) {
          return null
        }

        const routePath = path.resolve(dirpath, filename)
        const routeInstance = require(routePath)

        if (!routeInstance.expressRouter) {
          const relativePath = path.relative(rootpath, routePath)
          throw new Error(`Route instance is not exported from ${relativePath}`)
        }

        const mapping = {
          verb: tokens[1].toLowerCase(),
          order: parseInt(tokens[2], 10),
          filename,
          routeInstance
        }

        if (!validVerbs.includes(mapping.verb)) {
          return null
        }

        return mapping
      })
      .filter(mapping => !!mapping)

    // files may be like ['get.js', 'get-1.js', 'get-11.js', 'get12.js']
    // we want to order so that explicit numbers are in order,
    // and 'get.js' would come last
    files.sort((a, b) => {
      const aNaN = Number.isNaN(a.order)
      const bNaN = Number.isNaN(b.order)

      return aNaN && bNaN ? 0 :
        aNaN ? 1 :
        bNaN ? -1 :
        a.order < b.order ? -1 :
        a.order > b.order ? 1 :
        0
    })

    // lifting back up all.js to front
    files.sort((a, b) => {
      return a.verb < b.verb ? -1 :
        a.verb > b.verb ? 1 :
        0;
    })

    // 1. hoisting wildcard routes to top of handlers
    for (let i = 0; i < files.length; i++) {
      if (!files[i].routeInstance.wildcardRoute) {
        continue
      }

      const mapping = files.splice(i, 1)[0] // splicing it out of array so we don't add it to routing logic twice
      routes.push(mapping.routeInstance.expressRouter(mapping.verb, '/' + uriPathTokens.join('/')))
    }

    // 2. adding routes that are more specific
    for (let directory of subDirectories) {
      const subdirRoutes = getRoutes(path.resolve(dirpath, directory), uriPathTokens.slice())
      for (let r of subdirRoutes) {
        routes.push(r)
      }
    }

    // 3. $param directories are considered less specific
    for (let directory of paramDirectories) {
      const subdirRoutes = getRoutes(path.resolve(dirpath, directory), uriPathTokens.slice())
      for (let r of subdirRoutes) {
        routes.push(r)
      }
    }

    // 4. add current dir's handlers
    for (let mapping of files) {
      routes.push(mapping.routeInstance.expressRouter(mapping.verb, '/' + uriPathTokens.join('/')))
    }

    return routes
  }

  return getRoutes(rootpath)
}

module.exports = syncCrawlRoutesDir