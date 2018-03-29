/*eslint no-sync: 0*/

const fs = require('fs')
const path = require('path')
const sortInsensitive = require('@conjurelabs/utils/Array/sort-insensitive')

const validVerbs = ['all', 'get', 'post', 'put', 'patch', 'delete']
const startingDollarSign = /^\$/
const jsFileExt = /\.js$/

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
    const delayedDirectories = []
    const routes = []
    const files = []

    sortInsensitive(list)

    for (let i = 0; i < list.length; i++) {
      const stat = fs.statSync(path.resolve(dirpath, list[i]))

      if (stat.isFile() && jsFileExt.test(list[i])) {
        files.push(list[i])
        continue
      }

      if (stat.isDirectory()) {
        if (startingDollarSign.test(list[i])) {
          delayedDirectories.push(list[i])
          continue
        }

        const subdirRoutes = getRoutes(path.resolve(dirpath, list[i]), uriPathTokens.slice())

        for (let j = 0; j < subdirRoutes.length; j++) {
          routes.push(subdirRoutes[j])
        }
      }
    }

    for (let i = 0; i < delayedDirectories.length; i++) {
      const subdirRoutes = getRoutes(path.resolve(dirpath, delayedDirectories[i]), uriPathTokens.slice())

      for (let j = 0; j < subdirRoutes.length; j++) {
        routes.push(subdirRoutes[j])
      }
    }

    for (let i = 0; i < files.length; i++) {
      const verb = files[i].replace(jsFileExt, '').toLowerCase()

      if (!validVerbs.includes(verb)) {
        continue
      }

      const routePath = path.resolve(dirpath, files[i])
      const individualRoute = require(routePath)

      if (!individualRoute.expressRouter) {
        const relativePath = path.relativePath(rootpath, routePath)
        throw new Error(`Route instance is not exported from ${relativePath}`)
      }

      routes.push(individualRoute.expressRouter(verb, '/' + uriPathTokens.join('/')))
    }

    return routes
  }

  return getRoutes(rootpath)
}

module.exports = syncCrawlRoutesDir
