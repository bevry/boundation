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
function noop() {}

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

	// default to travis-ci.com
	state.travisTLD = 'com'
	let travisFlag = '--com'

	// travis env variables
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	if (answers.travisUpdateEnvironment) {
		// Detect which travis environments we are configured for

		// Attempt travis-ci.com first
		try {
			await spawn(['travis', 'enable', '--com'])
		} catch (err) {
			travisFlag = ''
		}

		// If travis-ci.com was successful, clear travis-ci.org
		if (state.travisTLD) {
			spawn(['travis', 'env', 'clear', '--force', '--org'], {
				stdio: false,
				output: false
			})
				.catch(noop)
				.finally(() =>
					spawn(['travis', 'disable', '--org'], {
						stdio: false,
						output: false
					}).catch(noop)
				)
		}
		// If travis-ci.com was unsuccessful, try travis-ci.org
		else {
			try {
				await spawn(['travis', 'enable', '--org'])
				state.travisTLD = 'org'
				travisFlag = '--org'
			} catch (err) {
				throw new Error(
					'Was unnsuccessful in enabling travis-ci for this repository'
				)
			}
		}

		// set the env vars
		await spawn([
			'travis',
			'env',
			'set',
			'DESIRED_NODE_VERSION',
			answers.desiredNodeVersion,
			'--public',
			travisFlag
		])
		if (answers.deployBranch) {
			await spawn([
				'travis',
				'env',
				'set',
				'DEPLOY_BRANCH',
				answers.deployBranch,
				travisFlag
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
				travisFlag
			])
		}
		if (answers.surgeToken) {
			await spawn([
				'travis',
				'env',
				'set',
				'SURGE_TOKEN',
				answers.surgeToken,
				travisFlag
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
				travisFlag
			])
			await spawn([
				'travis',
				'env',
				'unset',
				'NPM_USERNAME',
				'NPM_PASSWORD',
				'NPM_EMAIL',
				travisFlag
			])
		}
		await spawn([
			'travis',
			'env',
			'set',
			'NPM_BRANCH_TAG',
			'master:next',
			'--public',
			travisFlag
		])
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
		)
	}

	// output the result env vars
	if (answers.travisUpdateEnvironment)
		await spawn(['travis', 'env', 'list', travisFlag])

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
			travisFlag
		])
	}

	// note we are now finished with the travis file
	status('...wrote the travis file')

	// log
	status('...customised travis')
}

module.exports = { updateTravis }
