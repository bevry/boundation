'use strict'

const { version } = require('../package.json')
const root = require('path').resolve(__dirname, '..')
const cwd = process.cwd()
console.log(`Boundation v${version} [${root}]`)
console.log(`Running on [${cwd}]`)

module.exports = require('./index')(require('./state'))
