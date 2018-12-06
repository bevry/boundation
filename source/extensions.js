/* eslint no-console:0 */
'use strict'

const Errlop = require('errlop')

// Process unhandled rejections
process.on('unhandledRejection', function unhandledRejection(error) {
	console.error(new Errlop('An unhandled promise failed', error))
	process.exit(-1)
})
