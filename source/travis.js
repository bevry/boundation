/* eslint no-console:0 */
'use strict'

const Errlop = require('errlop').default

// curl flags:
// -L will follow redirects
// -s is silent mode, so will only return the result
// -S will show the error if something went wrong
// -f will not output errors as content
// https://github.com/bevry/boundation/issues/15
const curlFlags = '-fsSL'

// Local
const { writePackage } = require('./package')
const { status } = require('./log')
const { getGithubCommit } = require('./get-github-commit')
const { spawn, readYAML, writeYAML } = require('./fs')
const { hasScript } = require('./util')
function noop() {}

// Thing
async function updateTravis(state) {
	const { answers, nodeVersions, unsupportedNodeVersions, packageData } = state

	// =================================
	// customise travis

	status('customising travis...')

	// prepare
	/* eslint camelcase:0 */
	status('fetching github commit...')
	const awesomeTravisCommit = await getGithubCommit('bevry/awesome-travis')
	status('...fetched github commit')
	const travisOriginal = await readYAML('.travis.yml')
	const travis = {
		version: '~> 1.0',
		sudo: false,
		language: 'node_js',
		node_js: nodeVersions,
		matrix: {
			fast_finish: true,
			allow_failures: unsupportedNodeVersions.map((version) => ({
				node_js: version,
			})),
		},
		cache: answers.packageManager,
		install: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-install.bash)"`,
		],
		before_script: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-verify.bash)"`,
		],
		after_success: [],
	}

	// default to travis-ci.com
	state.travisTLD = ''
	const flags = ['--no-interactive']

	// update the travis file
	if (answers.cdnDeploymentStrategy === 'surge') {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/surge.bash)"`
		)
	}
	if (answers.travisWebsite || hasScript(packageData.scripts, 'my:deploy')) {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/deploy-custom.bash"`
		)
	}
	if (answers.npm || answers.cdnDeploymentStrategy === 'bevry') {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
		)
	}

	// re-add notifications if we aren't making new ones
	if (!answers.travisUpdateEnvironment && travisOriginal.notifications) {
		travis.notifications = travisOriginal.notifications
	}

	// trim empty fields to prevent travis errors like:
	// travis_run_after_success: command not found
	Object.keys(travis).forEach(function (key) {
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
	status('...wrote the travis file')

	// travis env variables
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	if (answers.travisUpdateEnvironment) {
		// Detect which travis environments we are configured for
		status('updating the travis environment...')

		// Attempt travis-ci.com first
		try {
			console.log('testing travis-ci.com')
			await spawn(['travis', 'enable', '--com', ...flags])
			console.log('success with travis-ci.com')
			try {
				console.log('clearing travis-ci.org')
				await spawn(['travis', 'env', 'clear', '--force', '--org', ...flags], {
					stdio: false,
					output: false,
				})
			} catch (err) {}
			try {
				console.log('disabling travis-ci.org')
				await spawn(['travis', 'disable', '--org', ...flags], {
					stdio: false,
					output: false,
				})
			} catch (err) {}
			console.log('using travis-ci.com')
			state.travisTLD = 'com'
			flags.push('--com')
		} catch (err) {
			console.log('travis-ci.com failed:', err)
			try {
				console.log('testing travis-ci.org')
				await spawn(['travis', 'enable', '--org', ...flags])
				console.log('using travis-ci.org')
				state.travisTLD = 'org'
				flags.push('--org')
			} catch (err) {
				state.travisTLD = ''
				throw new Errlop(
					'Was unnsuccessful in enabling travis-ci for this repository',
					err
				)
			}
		}

		// add the notifications
		if (answers.travisEmail) {
			await spawn([
				'travis',
				'encrypt',
				answers.travisEmail,
				'--add',
				'notifications.email.recipients',
				...flags,
			])
		}

		// set the env vars
		await spawn([
			'travis',
			'env',
			'set',
			'DESIRED_NODE_VERSION',
			answers.desiredNodeVersion,
			'--public',
			...flags,
		])
		if (answers.deployBranch) {
			await spawn([
				'travis',
				'env',
				'set',
				'DEPLOY_BRANCH',
				answers.deployBranch,
				...flags,
			])
		} else {
			await spawn(['travis', 'env', 'unset', 'DEPLOY_BRANCH', ...flags])
		}
		if (answers.surgeLogin) {
			await spawn([
				'travis',
				'env',
				'set',
				'SURGE_LOGIN',
				answers.surgeLogin,
				'--public',
				...flags,
			])
		} else {
			await spawn(['travis', 'env', 'unset', 'SURGE_LOGIN', ...flags])
		}
		if (answers.surgeToken) {
			await spawn([
				'travis',
				'env',
				'set',
				'SURGE_TOKEN',
				answers.surgeToken,
				...flags,
			])
		} else {
			await spawn(['travis', 'env', 'unset', 'SURGE_TOKEN', ...flags])
		}
		if (answers.bevryCDNToken) {
			await spawn([
				'travis',
				'env',
				'set',
				'BEVRY_CDN_TOKEN',
				answers.bevryCDNToken,
				...flags,
			])
		} else {
			await spawn(['travis', 'env', 'unset', 'BEVRY_CDN_TOKEN', ...flags])
		}
		if (answers.npmAuthToken) {
			await spawn([
				'travis',
				'env',
				'set',
				'NPM_AUTHTOKEN',
				answers.npmAuthToken,
				...flags,
			])
			await spawn([
				'travis',
				'env',
				'unset',
				'NPM_USERNAME',
				'NPM_PASSWORD',
				'NPM_EMAIL',
				...flags,
			])
		}
		if (answers.npm) {
			// publish all commits to the master branch to the npm tag next
			await spawn([
				'travis',
				'env',
				'set',
				'NPM_BRANCH_TAG',
				'master:next',
				'--public',
				...flags,
			])
			// proxy github api requests to the bevry server to work around rate limiting
			await spawn([
				'travis',
				'env',
				'set',
				'GITHUB_API',
				'https://bevry.me/api/github',
				'--public',
				...flags,
			])
		}
		// output the result env vars
		await spawn(['travis', 'env', 'list', ...flags])
		// status update
		status('...updated the travis environment')
	}

	// write the package.json file
	await writePackage(state)

	// log
	status('...customised travis')
}

module.exports = { updateTravis }
