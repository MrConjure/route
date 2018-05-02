const cors = require('cors')
const { PermissionsError, ContentError } = require('@conjurelabs/err')

const requireAuthenticationWrapper = Symbol('Require Auth Wrapper')
const wrapWithExpressNext = Symbol('Wrap async handlers with express next()')

const defaultOptions = {
  requireAuthentication: false,
  blacklistedEnv: {},
  wildcard: false
}

const optionHandlers = {
  requireAuthentication: handler => {
    const skippedHandler = this.skippedHandler

    return (req, res, next) => {
      if (!req.isAuthenticated()) {
        if (typeof skippedHandler === 'function') {
          return this[wrapWithExpressNext](skippedHandler)(req, res, next)
        }
        return next()
      }

      if (!req.user) {
        return next(new PermissionsError('No req.user available'))
      }

      this[wrapWithExpressNext](handler)(req, res, next)
    }
  },

  blacklistedEnv: 

  wildcard: 

  skippedHandler: handler => {

  }

  cors: 


}

/*
  You can use .withOptions to add additional options to all Route instances
  or to override existing options

  The functions receive two args; (userArg, { onHandler, onRoute })

  userArg         -->  option value given by the user

  onHandler       -->  called before adding each route handler into the express stack
                     
                        example
                        -------
                         
                        onHandler(({ handler }) => {
                          const newHandler = (req, res, next) => {
                            if (req.params.id === 23) {
                              return next(new Error(`Mike, you've been banned`))
                            }
                            handler(req, res, next)
                          }

                          return { handler: newHandler }
                        })

  beforeHanlder   -->   same as onHandler, but called first

  onRoute         -->  called before pushing the stack into the express stack

                        example
                        -------

                        onRoute(({ path, stack, router }) => {
                          // path is express route path
                          // stack is a function of handlers
                          // router is the express router instance

                          stack.push((req, res) => {
                            res.send('not found')
                          })

                          return { stack }
                        })

  beforeRoute     -->  same as onRoute, but runs before
*/
Route.withOptions({
  requireAuthentication: (shouldEnforce, { onHandler }) => {
    if (shouldEnforce !== true) {
      return
    }

    onHandler(({ handler }) => {
      return {
        handler: (req, res, next) => {
          if (!req.isAuthenticated() || !req.user) {
            return next()
          }
          handler(req, res, next)
        }
      }
    })
  },

  skippedHandler: (customHandler, { onRoute }) => {
    onRoute(({ stack }) => {
      stack.push(customHandler)
      return { stack }
    })
  },

  blacklistedEnv: (list, { onRoute }) => {
    let suppress = false

    for (const key in list) {
      const envVar = process.env[key]
      const blacklisted = list[key]

      if (!envVar) {
        continue
      }

      if (Array.isArray(blacklisted)) {
        if (blacklisted.includes(envVar)) {
          suppress = true
          break
        }
      } else if (envVar === blacklisted) {
        suppress = true
        break
      }
    }

    if (!suppress) {
      return
    }

    // if suppressing, then wipe the whole stack
    onRoute(() => { stack: [] })
  },

  wildcard: (shouldEnforce, { beforeRoute }) => {
    if (!shouldEnforce) {
      return
    }

    onRoute(({ path }) => {
      path: path.replace(/\/$/, '') + '*'
    })
  },

  cors: (corsArgs, { onRoute }) => {
    onRoute(({ path, stack, router }) => {
      // see https://github.com/expressjs/cors#enabling-cors-pre-flight
      router.options(path, cors(this.cors))
      stack.unshift(cors(corsArgs))

      return {
        stack,
        router
      }
    })
  }
})

class Route extends Array {
  constructor(options = {}) {
    super()

    const optionsUsed = {
      ...defaultOptions,
      ...options
    }

    this.requireAuthentication = optionsUsed.requireAuthentication
    this.wildcardRoute = optionsUsed.wildcard
    this.skippedHandler = optionsUsed.skippedHandler
    this.cors = optionsUsed.cors

    this.call = this.call.bind(this)

    this.suppressedRoutes = false
    for (const key in optionsUsed.blacklistedEnv) {
      const envVar = process.env[key]
      const blacklistedArray = optionsUsed.blacklistedEnv[key]

      if (envVar && blacklistedArray.includes(envVar)) {
        this.suppressedRoutes = true
        break
      }
    }
  }

  static set defaultOptions(options = {}) {
    for (const key in options) {
      defaultOptions[key] = options[key]
    }
  }

  [requireAuthenticationWrapper](handler) {
    const skippedHandler = this.skippedHandler

    return (req, res, next) => {
      if (!req.isAuthenticated()) {
        if (typeof skippedHandler === 'function') {
          return this[wrapWithExpressNext](skippedHandler)(req, res, next)
        }
        return next()
      }

      if (!req.user) {
        return next(new PermissionsError('No req.user available'))
      }

      this[wrapWithExpressNext](handler)(req, res, next)
    }
  }

  // wraps async handlers with next()
  [wrapWithExpressNext](handler) {
    if (handler instanceof Promise) {
      throw new ContentError('Express handlers need to be (req, res, next) or aysnc (req, res, next)')
    }

    if (handler.constructor.name !== 'AsyncFunction') {
      return handler
    }

    return (req, res, nextOriginal) => {
      // preventing double call on next()
      let nextCalled = false
      const next = (...args) => {
        if (nextCalled === true) {
          return
        }
        nextCalled = true

        nextOriginal(...args)
      }

      // express can't take in a promise (async func), so have to proxy it
      const handlerProxy = async callback => {
        try {
          await handler(req, res, callback)
        } catch(err) {
          callback(err)
        }
      }

      handlerProxy(err => next(err))
    }
  }

  expressRouterPrep() {
    // placeholder
  }

  expressRouter(verb, expressPath) {
    this.expressRouterPrep()

    const express = require('express')
    const router = express.Router()

    if (this.suppressedRoutes === true) {
      return router
    }

    const expressPathUsed = this.wildcardRoute ? expressPath.replace(/\/$/, '') + '*' : expressPath
    const expressVerb = verb.toLowerCase()

    for (const handler of this) {
      const methodUsed = this.requireAuthentication ? this[requireAuthenticationWrapper].bind(this) : this[wrapWithExpressNext].bind(this)

      if (this.cors) {
        // see https://github.com/expressjs/cors#enabling-cors-pre-flight
        router.options(expressPathUsed, cors(this.cors))
        router[expressVerb](expressPathUsed, cors(this.cors), methodUsed(handler))
      } else {
        router[expressVerb](expressPathUsed, methodUsed(handler))
      }
    }

    return router
  }

  async call(req, args = {}, params = {}) {
    req = {
      ...req,
      body: args,
      query: args,
      params
    }

    const tasks = [].concat(this)

    for (const task of tasks) {
      let taskResult
      const resProxy = {
        send: data => {
          taskResult = new DirectCallResponse(data)
        }
      }

      if (task.constructor.name === 'AsyncFunction') {
        await task(req, resProxy)
      } else {
        await promisifiedHandler(task, req, resProxy)
      }

      if (taskResult) {
        if (taskResult instanceof DirectCallResponse) {
          return taskResult.data
        }
        return
      }
    }
  }
}

class DirectCallResponse {
  constructor(data) {
    this.data = data
  }
}

function promisifiedHandler(handler, req, res) {
  return new Promise((resolve, reject) => {
    const originalSend = res.send
    res.send = (...args) => {
      resolve(...args)
      originalSend(...args)
    }
    handler(req, res, err => {
      if (err) {
        reject(err)
      }
    })
  })
}

module.exports = Route
