/* eslint no-console:0 no-use-before-define:0 */
'use strict'

// Local
const { status } = require('./log')
const { isSpecified } = require('./string')
const { spawn, write, unlink, exists, rename } = require('./fs')
const { readPackage, writePackage } = require('./package')
const { versionComparator } = require('./version')
const { getAnswers } = require('./answers')

// External
const pathUtil = require('path')
const { Versions } = require('@bevry/testen')
const semver = require('semver')

// Helpers
function nodeMajorVersion (value) {
	return value.startsWith('0') ? value.split('.').slice(0, 2).join('.') : value.split('.')[0]
}
function addLatest (array) {
	return array.map((item) => `${item}@latest`)
}

// function completeVersion (value) {
// 	const version = value.toString()
// 	const parts = version.split('.').length
// 	if (parts === 2) {
// 		return version + '.0'
// 	}
// 	else if (parts === 1) {
// 		return version + '.0.0'
// 	}
// 	else {
// 		return version
// 	}
// }
// function completeVersions (list) {
// 	return list.map(completeVersion)
// }

// Update engines
async function updateEngines (state) {
	const { answers, supportedNodeVersions, nodeVersions } = state

	// =================================
	// run each edition against the supported node version
	// to fetch the engines for each edition

	for (const edition of state.editions) {
		if (edition.engines && edition.engines.node) {
			status(`determining engines for edition ${edition.directory}...`)
			const testPath = pathUtil.join(edition.directory || '.', edition.testEntry)
			const versions = new Versions(supportedNodeVersions.concat((edition.targets && edition.targets.node) || []))
			await versions.load()
			await versions.install()
			const numbers = versions.map((version) => version.version)
			await versions.test(`node --harmony ./${testPath} --joe-reporter=console`)
			const passed = versions.json.passed || []
			const failed = versions.json.failed || []
			if (passed.length === 0) {
				console.error(versions.messages.join('\n\n'))
				throw new Error(`The edition ${edition.directory} had no node versions [${numbers.join(', ')}] which its tests passed`)
			}
			if (typeof edition.engines.node === 'string') {
				const uhoh = failed.filter((version) => semver.satisfies(version, edition.engines.node))
				if (uhoh.length) {
					console.error(versions.messages.join('\n\n'))
					throw new Error(`The edition ${edition.directory} needed to support ${edition.engines.node} but failed on [${failed.join(', ')}]`)
				}
			}
			edition.engines.node = '>=' + nodeMajorVersion(passed[0])
			status(`...determined engines for edition ${edition.directory} as ${edition.engines.node} against ${numbers.join(', ')}`)
		}
	}

	// =================================
	// update the package.json file

	await writePackage(state)

	// =================================
	// trim useless editions

	// if the current edition supports the lower next edition, then keep the current and discard the next
	const nodeEditions = state.editions.filter((edition) => edition.engines.node)
	const uselessEditions = nodeEditions.filter(function (current, index) {
		const previous = nodeEditions[index - 1]
		return previous && current.engines.node === previous.engines.node
	})
	if (uselessEditions.length) {
		status(`removing useless editions ${uselessEditions.map((edition) => edition.directory).join(', ')}...`)
		state.editions = state.editions.filter((edition) => uselessEditions.includes(edition) === false)
		status('...removed useless editions')
		return await updateRuntime(state)
	}

	// =================================
	// figure out engines.node

	status('determining engines for project...')
	const versions = new Versions(nodeVersions)
	await versions.load()
	await versions.install()
	const numbers = versions.map((version) => version.version)
	await versions.test('npm test')
	const passed = versions.json.passed || []
	if (passed.length === 0) {
		console.error(versions.messages.join('\n\n'))
		throw new Error(`There were no node versions [${numbers.join(', ')}] which the project's tests passed`)
	}
	status('...determined engines for project')

	// check if minimum supported node version is still the minimum supported node version
	if (versionComparator(passed[0], answers.minimumSupportNodeVersion) !== 0) {
		console.error(versions.messages.join('\n\n'))
		const message = [
			`The project actually supports the minimum node version ${passed[0]} which is different than your specified minimum supported node version ${answers.minimumSupportNodeVersion}`,
			'What would you like to do?'
		].join('\n')
		const query = await getAnswers([{
			name: 'action',
			type: 'list',
			choices: ['ignore', 'fail'],
			validate: isSpecified,
			message
		}])
		if (query.action === 'fail') {
			return process.exit(1)
		}
	}

	// =================================
	// update the package.json file

	await writePackage(state)
}

async function scaffoldEditions (state) {
	const { editions, packageData, answers } = state
	const useEditions = editions && editions.length
	const useEditionAutoloader = editions && editions.length > 1
	if (useEditions) {
		const sourceEdition = editions[0]
		const sourceMainEntry = sourceEdition.entry
		const sourceTestEntry = sourceEdition.testEntry
		const sourceMainPath = pathUtil.join(sourceEdition.directory || '.', sourceMainEntry)
		const sourceTestPath = pathUtil.join(sourceEdition.directory || '.', sourceTestEntry)

		// log
		status('scaffolding edition files...')

		// scaffold directories
		await spawn(['mkdir', '-p'].concat(
			editions.map(
				(edition) => edition.directory || '.'
			)
		))

		// Move original files to new locations if needed
		const sourceMainPathExists = await exists(sourceMainPath)
		const sourceMainEntryExists = await exists(sourceMainEntry)
		const sourceTestPathExists = await exists(sourceTestPath)
		const sourceTestEntryExists = await exists(sourceTestEntry)
		if (!sourceMainPathExists && sourceMainEntryExists) await rename(sourceMainEntry, sourceMainPath)
		if (!sourceTestPathExists && sourceTestEntryExists) await rename(sourceTestEntry, sourceTestPath)

		// scaffold above paths if non existent
		await spawn(['touch', sourceMainPath, sourceTestPath])

		// setup main and test paths
		if (useEditionAutoloader) {
			// this is the case for any language that requires compilation
			await write('index.js', [
				"'use strict'",
				'',
				`/** @type {typeof import("./${sourceMainPath}") } */`,
				"module.exports = require('editions').requirePackage(__dirname, require)",
				''
			].join('\n'))
			await write('test.js', [
				"'use strict'",
				'',
				`/** @type {typeof import("./${sourceTestPath}") } */`,
				`module.exports = require('editions').requirePackage(__dirname, require, '${answers.testEntry}')`,
				''
			].join('\n'))
			packageData.main = 'index.js'
			state.test = 'test.js'
		}
		else {
			await unlink('index.js')
			await unlink('test.js')
			packageData.main = sourceMainPath
			state.test = sourceTestPath
		}

		// browser path
		if (answers.browser) {
			const browserEdition = editions.find((edition) => edition.engines && edition.engines.browsers) || sourceEdition
			packageData.browser = pathUtil.join(browserEdition.directory || '.', browserEdition.entry)
		}

		// log
		status('...scaffolded edition files')
	}
	else if (answers.browser) {
		packageData.browser = packageData.main
	}
	else {
		delete packageData.browser
	}
}

// Update runtime
async function updateRuntime (state) {
	const { answers, packageData } = state

	// log
	status('updating runtime...')

	// =================================
	// editions

	await scaffoldEditions(state)

	// =================================
	// scripts and dependencies

	/** @type {Object.<string, boolean | string>} */
	const packages = {
		'projectz': 'dev',
		'assert-helpers': false,
		'joe': false,
		'joe-reporter-console': false,
		'editions': state.editions && state.editions.length > 1,
		'surge': false,
		'now': false,
		'babel-cli': false,
		'babel-core': false,
		'babel-preset-es2015': false,
		'babel-preset-env': false,
		'documentation': false,
		'flow-bin': false,
		'coffee-script': false,
		'yuidocjs': false,
		'biscotto': false,
		'eslint': false,
		'stylelint': false,
		'coffeelint': false,
		'coffeescript':
			packageData.devDependencies.coffeescript || packageData.devDependencies['coffee-script']
				? 'dev'
				: packageData.dependencies.coffeescript || packageData.dependencies['coffee-script']
					? true
					: answers.languages === 'coffeescript'
						? 'dev'
						: false
	}

	// scripts are handled at write time
	state.scripts = Object.assign(
		{
			'our:setup:npm': 'npm install',
			'our:clean': 'rm -Rf ./docs ./edition:* ./es2015 ./es5 ./out',
			'our:meta:projectz': 'projectz compile',
			'our:test': 'npm run our:verify && npm test',
			'our:release:prepare': 'npm run our:clean && npm run our:compile && npm run our:test && npm run our:meta',
			'test': `node --harmony ./${state.test} --joe-reporter=console`
		},
		answers.npm
			? {
				'our:release:check-changelog': 'cat ./HISTORY.md | grep v$npm_package_version || (echo add a changelog entry for v$npm_package_version && exit -1)',
				'our:release:check-dirty': 'git diff --exit-code',
				'our:release:tag': "export MESSAGE=$(cat ./HISTORY.md | sed -n \"/## v$npm_package_version/,/##/p\" | sed 's/## //' | awk 'NR>1{print buf}{buf = $0}') && test \"$MESSAGE\" || (echo 'proper changelog entry not found' && exit -1) && git tag v$npm_package_version -am \"$MESSAGE\"",
				'our:release:push': 'git push origin master && git push origin --tags',
				'our:release': 'npm run our:release:prepare && npm run our:release:check-changelog && npm run our:release:check-dirty && npm run our:release:tag && npm run our:release:push'
			} :
			{
				'our:release:push': 'git push origin master && git push origin --tags',
				'our:release': 'npm run our:release:push'
			}
	)

	// merge in editions[scripts]
	if (state.editions && state.editions.length) {
		Object.assign(state.scripts, ...state.editions.map((edition) => edition.scripts || {}))
	}

	// add the various scripts
	if (answers.docpadPlugin) {
		packages.docpad = 'dev'
		state.scripts['our:setup:docpad'] = 'bash ./docpad-setup.sh'
	}
	else if (answers.docpadWebsite) {
		packages.docpad = 'dev'
		state.scripts.test = 'docpad generate --env static'
	}
	if (answers.languages.has('css')) {
		packages.coffeelint = 'stylelint'
		state.scripts['our:verify:stylelint'] = `stylelint --fix './${answers.sourceDirectory}/**/*.css'`
	}
	if (answers.languages.has('coffeescript')) {
		packages.coffeelint = 'dev'
		state.scripts['our:verify:coffeelint'] = `coffeelint ./${answers.sourceDirectory}`
	}
	if (answers.languages.has('esnext')) {
		packages.eslint = 'dev'
		state.scripts['our:verify:eslint'] = `eslint --fix ./${answers.sourceDirectory}`
	}
	if (answers.docs) {
		if (answers.language === 'coffescript') {
			if (packageData.devDependencies.biscotto) {
				packages.biscotto = 'dev'
				state.scripts['our:meta:biscotto'] = `biscotto -n "$npm_package_title" --title "$npm_package_title API Documentation" --readme README.md --output-dir ./docs ./${answers.sourceDirectory} - LICENSE.md HISTORY.md`
			}
			else {
				packages.yuidocjs = 'dev'
				state.scripts['our:meta:yuidoc'] = `yuidoc -o ./docs --syntaxtype coffee -e .coffee ./${answers.sourceDirectory}`
			}
		}
		else if (answers.language === 'esnext') {
			packages.documentation = 'dev'
			state.scripts['our:meta:docs'] = `documentation build -f html -o ./docs -g --shallow ./${answers.sourceDirectory}/**.js`
		}
	}
	if (answers.flowtype) {
		packages['flow-bin'] = 'dev'
		state.scripts['our:verify:flow'] = 'flow check'
	}
	if (answers.babel) {
		packages['babel-cli'] = packages['babel-preset-env'] = 'dev'
	}
	if (answers.deploy === 'surge') {
		packages.surge = 'dev'
		state.scripts['my:deploy'] = `surge ./${answers.deployDirectory}`
	}
	else if (answers.docs) {
		packages.surge = 'dev'
	}
	if (answers.deploy && answers.deploy.startsWith('now')) {
		packages.now = 'dev'
	}
	if (!answers.docpadPlugin && !answers.website) {
		packages.joe = packages['joe-reporter-console'] = packages['assert-helpers'] = 'dev'
	}

	// write the package.json file
	await writePackage(state)

	// install the development dependencies
	const addDependencies = Object.keys(packages).filter((key) => packages[key] === true)
	const addDevDependencies = Object.keys(packages).filter((key) => packages[key] === 'dev')
	const removeDependencies = Object.keys(packages).filter((key) => packages[key] === false && (packageData.dependencies[key] || packageData.devDependencies[key]))
	if (addDependencies.length) {
		status('adding the dependencies...')
		await spawn(['npm', 'install', '--save'].concat(addLatest(addDependencies)))
		status('...added the dependencies')
	}
	if (addDevDependencies.length) {
		status('adding the development dependencies...')
		await spawn(['npm', 'install', '--save-dev'].concat(addLatest(addDevDependencies)))
		status('...added the development dependencies')
	}
	if (removeDependencies.length) {
		status('remove old dependencies...')
		await spawn(['npm', 'uninstall', '--save', '--save-dev'].concat(addLatest(removeDependencies)))
		status('...removed old dependencies')
	}

	if (answers.upgradeAllDependencies) {
		status('upgrading the installed dependencies...')
		try {
			await spawn(['ncu', '-u'])
		}
		catch (err) {
			await spawn(['npm', 'install', '-g', 'npm-check-updates'])
			await spawn(['ncu', '-u'])
		}
		status('...upgraded all the installed dependencies')
	}

	status('installing the dependencies...')
	await spawn(['npm', 'install'])
	status('...installed all the dependencies')

	// remove old files
	status('removing old files...')
	await Promise.all([
		'esnextguardian.js',
		'nakefile.js',
		'Cakefile',
		'cyclic.js',
		'.jshintrc',
		'.jscrc'
	].map((file) => unlink(file)))
	status('...removed old files')

	// running setup
	status('running setup...')
	await spawn('npm run our:setup')
	status('...ran setup')

	// running clean
	status('running clean...')
	await spawn('npm run our:clean')
	status('...ran clean')

	// running compile
	status('running compile...')
	await spawn('npm run our:compile')
	status('...ran compile')

	// read the updated package.json file
	await readPackage(state)

	// continue
	await updateEngines(state)

	// log
	status('...updated runtime')

}

module.exports = { updateRuntime }
