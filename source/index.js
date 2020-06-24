/* eslint no-sync:0, camelcase:0, no-console:0 */
'use strict'

// unhandledRejection
require('./extensions')

// Local
const { status, success } = require('./log')
const { spawn } = require('./fs.js')
const { readPackage, updatePackageData } = require('./package.js')
const { updateTravis } = require('./travis.js')
const { getAnswers } = require('./questions.js')
const { updateBaseFiles } = require('./base.js')
const { generateEditions } = require('./editions.js')
const { readWebsite, updateWebsite } = require('./website.js')
const { updateRuntime } = require('./runtime.js')
const { updateVersions } = require('./versions.js')

async function init(state) {
	await readPackage(state)

	await readWebsite(state)

	await getAnswers(state)

	await updateVersions(state)

	await updatePackageData(state)

	await generateEditions(state)

	await updateWebsite(state)

	await updateBaseFiles(state)

	await updateRuntime(state)

	await updateTravis(state)

	// and finish it all up
	status('running release prepare...')
	await spawn([state.answers.packageManager, 'run', 'our:release:prepare'])
	status('...ran release prepare')

	// log
	success('all done!')
}

module.exports = init
