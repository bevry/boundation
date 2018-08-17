/* eslint no-sync:0, camelcase:0, no-console:0 */
'use strict'

// Extend
require('./extensions')

// Local
const { status, success } = require('./log')
const { spawn } = require('./fs')
const { readPackage, updatePackageData } = require('./package')
const { updateTravis } = require('./travis')
const { getAnswers } = require('./questions')
const { updateBaseFiles } = require('./base')
const { updateEditions } = require('./editions')
const { updateWebsite } = require('./website')
const { updateRuntime } = require('./runtime')

async function init (state) {
	await readPackage(state)

	await getAnswers(state)

	await updatePackageData(state)

	await updateEditions(state)

	await updateWebsite(state)

	await updateBaseFiles(state)

	await updateTravis(state)

	await updateRuntime(state)

	// and finish it all up
	status('running release prepare...')
	await spawn('npm run our:release:prepare')
	status('...ran release prepare')

	// log
	success('all done!')
}

module.exports = init
