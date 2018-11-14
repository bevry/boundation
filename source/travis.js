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
async function updateTravis (state) {
	const { answers } = state

	// =================================
	// customise travis

	status('customising travis...')

	// fetch node versions
	state.nodeVersions = allNodeVersions.filter((version) =>
		versionComparator(version, answers.minimumTestNodeVersion) >= 0
		&&
		versionComparator(version, answers.maximumTestNodeVersion) <= 0
	)
	state.unsupportedNodeVersions = state.nodeVersions.filter((version) =>
		versionComparator(version, answers.minimumSupportNodeVersion) < 0
		||
		versionComparator(version, answers.maximumSupportNodeVersion) > 0
	)
	state.supportedNodeVersions = state.nodeVersions.filter((version) =>
		versionComparator(version, answers.minimumSupportNodeVersion) >= 0
		&&
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
			allow_failures: state.unsupportedNodeVersions.map((version) => ({ node_js: version }))
		},
		cache: {
			directories: [
				'$HOME/.npm',
				'$HOME/.yarn-cache'
			]
		},
		install: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-install.bash)"`
		],
		before_script: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-verify.bash)"`
		],
		after_success: []
	}

	// travis env variables
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	if (answers.travisUpdateEnvironment) {
		await spawn(['travis', 'enable'])
		await spawn(['travis', 'env', 'set', 'DESIRED_NODE_VERSION', answers.desiredNodeVersion, '--public'])
		if (answers.surgeLogin) {
			await spawn(['travis', 'env', 'set', 'SURGE_LOGIN', answers.surgeLogin, '--public'])
		}
		if (answers.surgeToken) {
			await spawn(['travis', 'env', 'set', 'SURGE_TOKEN', answers.surgeToken])
		}
		if (answers.nowToken) {
			await spawn(['travis', 'env', 'set', 'NOW_TOKEN', answers.nowToken])
		}
		if (answers.nowTeam) {
			await spawn(['travis', 'env', 'set', 'NOW_TEAM', answers.nowTeam, '--public'])
		}
	}
	if (answers.docs) {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/surge.bash)"`
		)
	}
	if (answers.deploy) {
		const deployScripts = {
			'now-custom': 'deploy-now.bash',
			'now-static': 'deploy-now.bash',
			'surge': 'deploy-custom.bash',
			'custom': 'deploy-custom.bash'
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
			await spawn(['travis', 'env', 'set', 'NPM_AUTHTOKEN', answers.npmAuthToken])
			await spawn(['travis', 'env', 'unset', 'NPM_USERNAME', 'NPM_PASSWORD', 'NPM_EMAIL'])
		}
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
		)
	}

	// output the variables
	if (answers.travisUpdateEnvironment) await spawn(['travis', 'env', 'list'])

	// write the .travis.yml file
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	status('writing the travis file...')
	await write('.travis.yml', yaml.dump(travis))
	if (answers.travisEmail) {
		await spawn(['travis', 'encrypt', answers.travisEmail, '--add', 'notifications.email.recipients'])
	}
	status('...wrote the travis file')

	// log
	status('...customised travis')
}

module.exports = { updateTravis }
