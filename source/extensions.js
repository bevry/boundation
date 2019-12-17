/* eslint no-console:0 */
'use strict'

// Import
const Errlop = require('errlop').default

// Process unhandled rejections
process.on('unhandledRejection', function unhandledRejection(error) {
	console.error(new Errlop('An unhandled promise failed', error))
	process.exit(-1)
})
