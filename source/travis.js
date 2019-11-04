/* eslint no-console:0 */
'use strict'

// curl flags:
// -L will follow redirects
// -s is silent mode, so will only return the result
// -S will show the error if something went wrong
// -f will not output errors as content
// https://github.com/bevry/boundation/issues/15
const curlFlags = '-fsSL'

// Local
const { status } = require('./log')
const { getGithubCommit } = require('./get-github-commit')
const { spawn, readYAML, writeYAML } = require('./fs')

// Thing
async function updateTravis(state) {
	const { answers, nodeVersions, unsupportedNodeVersions } = state

	// =================================
	// customise travis

	status('customising travis...')

	// prepare
	/* eslint camelcase:0 */
	const awesomeTravisCommit = await getGithubCommit('bevry/awesome-travis')
	const travisOriginal = await readYAML('.travis.yml')
	const travis = {
		sudo: false,
		language: 'node_js',
		node_js: nodeVersions,
		matrix: {
			fast_finish: true,
			allow_failures: unsupportedNodeVersions.map(version => ({
				node_js: version
			}))
		},
		cache: answers.packageManager,
		install: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-install.bash)"`
		],
		before_script: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-verify.bash)"`
		],
		after_success: []
	}
	let com, org, clearFlag, usedFlag, unusedFlag

	// travis env variables
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	if (answers.travisUpdateEnvironment) {
		// Detect which travis environments we are configured for
		try {
			await spawn(['travis', 'status', '--com'])
			com = true
		} catch (err) {}
		try {
			await spawn(['travis', 'status', '--org'])
			org = true
		} catch (err) {}

		// Based on the above, set the used and unused
		if (com || !org) {
			state.travisTLD = 'com'
			usedFlag = '--com'
			unusedFlag = '--org'
			if (org) {
				clearFlag = '--org'
			}
		} else {
			state.travisTLD = 'org'
			usedFlag = '--org'
			unusedFlag = '--com'
			if (com) {
				clearFlag = '--com'
			}
		}

		// update the user
		status(
			`determined travis env to be ${usedFlag}, enabling ${usedFlag}, and disabling ${unusedFlag}...`
		)

		// enable the used, disable the unused
		await spawn(['travis', 'enable', usedFlag])
		try {
			await spawn(['travis', 'disable', unusedFlag])
		} catch (err) {}

		// clear the env of the unused
		if (clearFlag) {
			status(`clearing the old travis env of ${clearFlag}...`)
			spawn(['travis', 'env', 'clear', '--force', clearFlag])
			status(`...cleared`)
		}

		// set the env vars
		await spawn([
			'travis',
			'env',
			'set',
			'DESIRED_NODE_VERSION',
			answers.desiredNodeVersion,
			'--public',
			usedFlag
		])
		if (answers.deployBranch) {
			await spawn([
				'travis',
				'env',
				'set',
				'DEPLOY_BRANCH',
				answers.deployBranch,
				usedFlag
			])
		}
		if (answers.surgeLogin) {
			await spawn([
				'travis',
				'env',
				'set',
				'SURGE_LOGIN',
				answers.surgeLogin,
				'--public',
				usedFlag
			])
		}
		if (answers.surgeToken) {
			await spawn([
				'travis',
				'env',
				'set',
				'SURGE_TOKEN',
				answers.surgeToken,
				usedFlag
			])
		}
	}
	if (answers.docs) {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/surge.bash)"`
		)
	}
	if (answers.travisWebsite) {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/deploy-custom.bash"`
		)
	}
	if (answers.npm) {
		if (answers.npmAuthToken && answers.travisUpdateEnvironment) {
			await spawn([
				'travis',
				'env',
				'set',
				'NPM_AUTHTOKEN',
				answers.npmAuthToken,
				usedFlag
			])
			await spawn([
				'travis',
				'env',
				'unset',
				'NPM_USERNAME',
				'NPM_PASSWORD',
				'NPM_EMAIL',
				usedFlag
			])
		}
		await spawn([
			'travis',
			'env',
			'set',
			'NPM_BRANCH_TAG',
			'master:next',
			'--public',
			usedFlag
		])
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
		)
	}

	// output the result env vars
	if (answers.travisUpdateEnvironment)
		await spawn(['travis', 'env', 'list', usedFlag])

	// re-add notifications if we aren't making new ones
	if (!answers.travisUpdateEnvironment && travisOriginal.notifications) {
		travis.notifications = travisOriginal.notifications
	}

	// trim empty fields to prevent travis errors like:
	// travis_run_after_success: command not found
	Object.keys(travis).forEach(function(key) {
		const value = travis[key]
		if (Array.isArray(value) && value.length === 0) {
			delete travis[key]
		} else if (typeof value === 'object' && Object.keys(value).length === 0) {
			delete travis[key]
		} else if (value === '' || value == null) {
			delete travis[key]
		}
	})

	// write the .travis.yml file
	status('writing the travis file...')
	await writeYAML('.travis.yml', travis)

	// add the notifications
	if (answers.travisUpdateEnvironment && answers.travisEmail) {
		await spawn([
			'travis',
			'encrypt',
			answers.travisEmail,
			'--add',
			'notifications.email.recipients',
			usedFlag
		])
	}

	// note we are now finished with the travis file
	status('...wrote the travis file')

	// log
	status('...customised travis')
}

module.exports = { updateTravis }
