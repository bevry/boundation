// external
import { preloadNodeVersions } from '@bevry/nodejs-versions'

// local
import { status, success } from './log.js'
import { spawn } from './fs.js'
import { readPackage, updatePackageData } from './package.js'
import { updateCI } from './ci.js'
import { getAnswers } from './questions.js'
import { updateBaseFiles } from './base.js'
import { generateEditions } from './editions.js'
import { readWebsite, updateWebsite } from './website.js'
import { updateRuntime } from './runtime.js'

export default async function init(state) {
	await preloadNodeVersions()

	await readPackage(state)

	await readWebsite(state)

	await getAnswers(state)

	await updatePackageData(state)

	await generateEditions(state)

	await updateWebsite(state)

	await updateBaseFiles(state)

	await updateRuntime(state)

	await updateCI(state)

	// and finish it all up
	status('running release prepare...')
	await spawn([state.answers.packageManager, 'run', 'our:release:prepare'])
	status('...ran release prepare')

	// log
	success('all done!')
}
