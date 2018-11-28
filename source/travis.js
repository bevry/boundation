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
const { allNodeVersions } = require('./data')
const { versionComparator } = require('./version')
const { getGithubCommit } = require('./get-github-commit')
const { spawn, write } = require('./fs')

// External
const yaml = require('js-yaml')

// Thing
async function updateTravis(state) {
	const { answers } = state

	// =================================
	// customise travis

	status('customising travis...')

	// fetch node versions
	state.nodeVersions = allNodeVersions.filter(
		version =>
			versionComparator(version, answers.minimumTestNodeVersion) >= 0 &&
			versionComparator(version, answers.maximumTestNodeVersion) <= 0
	)
	state.unsupportedNodeVersions = state.nodeVersions.filter(
		version =>
			versionComparator(version, answers.minimumSupportNodeVersion) < 0 ||
			versionComparator(version, answers.maximumSupportNodeVersion) > 0
	)
	state.supportedNodeVersions = state.nodeVersions.filter(
		version =>
			versionComparator(version, answers.minimumSupportNodeVersion) >= 0 &&
			versionComparator(version, answers.maximumSupportNodeVersion) <= 0
	)

	// prepare
	/* eslint camelcase:0 */
	const awesomeTravisCommit = await getGithubCommit('bevry/awesome-travis')
	const travis = {
		sudo: false,
		language: 'node_js',
		node_js: state.nodeVersions,
		matrix: {
			fast_finish: true,
			allow_failures: state.unsupportedNodeVersions.map(version => ({
				node_js: version
			}))
		},
		cache: {
			directories: ['$HOME/.npm', '$HOME/.yarn-cache']
		},
		install: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-install.bash)"`
		],
		before_script: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-verify.bash)"`
		],
		after_success: []
	}
	let com, org, used, clearFlag, usedFlag, unusedFlag

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
		if (answers.nowToken) {
			await spawn([
				'travis',
				'env',
				'set',
				'NOW_TOKEN',
				answers.nowToken,
				usedFlag
			])
		}
		if (answers.nowTeam) {
			await spawn([
				'travis',
				'env',
				'set',
				'NOW_TEAM',
				answers.nowTeam,
				'--public',
				usedFlag
			])
		}
	}
	if (answers.docs) {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/surge.bash)"`
		)
	}
	if (answers.deploy) {
		const deployScripts = {
			'now-custom': 'deploy-now',
			'now-static': 'deploy-now',
			surge: 'deploy-custom',
			custom: 'deploy-custom'
		}
		const deployScript = deployScripts[answers.deploy]
		if (deployScript) {
			travis.after_success.push(
				`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/${deployScript}.bash)"`
			)
		}
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
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
		)
	}

	// output the resul env vars
	if (answers.travisUpdateEnvironment)
		await spawn(['travis', 'env', 'list', usedFlag])

	// write the .travis.yml file
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	status('writing the travis file...')
	await write('.travis.yml', yaml.dump(travis))
	if (answers.travisEmail) {
		await spawn([
			'travis',
			'encrypt',
			answers.travisEmail,
			'--add',
			'notifications.email.recipients',
			usedFlag
		])
	}
	status('...wrote the travis file')

	// log
	status('...customised travis')
}

module.exports = { updateTravis }
