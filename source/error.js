/* eslint no-console:0 */
'use strict'

/**
 * @param {Error} error
 * @returns {string}
 */
function stackOrMessage(error) {
	return error.stack ? `\n${error.stack}` : error.toString()
}

/**
 * @param {Error} reason
 * @returns {void}
 */
function unhandledRejection(reason) {
	console.error(`\nA promise FAILED with: ${stackOrMessage(reason)}`)
	process.exit(-1)
}

module.exports = { stackOrMessage, unhandledRejection }
