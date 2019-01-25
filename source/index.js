/* eslint no-sync:0, camelcase:0, no-console:0 */
'use strict'

// unhandledRejection
require('./extensions')

// Local
const { status, success } = require('./log')
const { spawn } = require('./fs')
const { readPackage, updatePackageData } = require('./package')
const { updateTravis } = require('./travis')
const { getAnswers } = require('./questions')
const { updateBaseFiles } = require('./base')
const { generateEditions } = require('./editions')
const { readWebsite, updateWebsite } = require('./website')
const { updateRuntime } = require('./runtime')
const { updateVersions } = require('./versions')

async function init(state) {
	await readPackage(state)

	await readWebsite(state)

	await getAnswers(state)

	await updateVersions(state)

	await updatePackageData(state)

	await generateEditions(state)

	await updateWebsite(state)

	await updateBaseFiles(state)

	await updateTravis(state)

	await updateRuntime(state)

	// and finish it all up
	status('running release prepare...')
	await spawn(`${state.answers.packageManager} run our:release:prepare`)
	status('...ran release prepare')

	// log
	success('all done!')
}

module.exports = init
