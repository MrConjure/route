const { test } = require('ava')
const path = require('path')
const express = require('express')
const syncCrawl = require('../../sync-crawl')

const Router = express.Router

const crawl = dirname => {
  return syncCrawl(path.resolve(__dirname, 'helpers', dirname))
}

test('should return an array', t => {
  const routes = crawl('routes-00')
  t.true(Array.isArray(routes))
  t.is(routes.length, 1)
})

test('should return expected results when handled', t => {
  const router = new Router()
  router.use(crawl('routes-00'))
  router.handle({ url: '/', method: 'GET' }, {
    send: val => {
      t.is(val, 'Howdy')
    }
  })
})

test('should return expected results when there are several handlers and dirs', t => {
  const router = new Router()
  router.use(crawl('routes-01'))

  router.handle({ url: '/', method: 'GET' }, {
    send: val => {
      t.is(val, 'GET 1')
    }
  })
  router.handle({ url: '/', method: 'POST' }, {
    send: val => {
      t.is(val, 'POST 1')
    }
  })
  router.handle({ url: '/', method: 'PATCH' }, {
    send: val => {
      t.is(val, 'PATCH 1')
    }
  })
  router.handle({ url: '/', method: 'PUT' }, {
    send: val => {
      t.is(val, 'PUT 1')
    }
  })
  router.handle({ url: '/', method: 'DELETE' }, {
    send: val => {
      t.is(val, 'DELETE 1')
    }
  })

  router.handle({ url: '/account', method: 'GET' }, {
    send: val => {
      t.is(val, 'GET 2')
    }
  })
  router.handle({ url: '/account', method: 'POST' }, {
    send: val => {
      t.is(val, 'POST 2')
    }
  })
  router.handle({ url: '/account', method: 'PATCH' }, {
    send: val => {
      t.is(val, 'PATCH 2')
    }
  })
  router.handle({ url: '/account', method: 'PUT' }, {
    send: val => {
      t.is(val, 'PUT 2')
    }
  })
  router.handle({ url: '/account', method: 'DELETE' }, {
    send: val => {
      t.is(val, 'DELETE 2')
    }
  })

})