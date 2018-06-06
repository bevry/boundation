#!/usr/bin/env node
'use strict'

if (process.argv[2] === '--version') {
	console.log(require('./package.json').version)
	process.exit()
}

module.exports = require('.')
