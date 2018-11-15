/* eslint no-console:0 no-use-before-define:0 */
'use strict'

// Local
const { status } = require('./log')
const { isSpecified } = require('./string')
const { spawn, write, unlink, exists, rename, contains } = require('./fs')
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
function nodeMajorVersions (array) {
	return array.map((version) => nodeMajorVersion(version))
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
	const { answers, supportedNodeVersions, nodeVersions, packageData } = state
	const nodeEditions = state.nodeEditions
	let minimumPassingVersion = null

	// =================================
	// run each edition against the supported node version
	// to fetch the engines for each edition

	if (nodeEditions.length === 0) {
		// this can be the case if it is a website
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
		else {
			minimumPassingVersion = passed[0]
			packageData.engines.node = nodeMajorVersions(passed).join(' || ')
		}
		status(`...determined engines for project as [${state.engines.node}] against [${numbers.join(', ')}]`)
	}
	else {
		const versionsAlreadySupported = new Set()
		let recompile = false

		/* eslint no-loop-func:0 */
		for (const edition of nodeEditions) {
			status(`determining engines for edition [${edition.directory}]...`)

			// run the test for the edition, and determine the results
			const test = answers.docpadPlugin
				? `docpad-plugintester --edition=${edition.directory}`
				: `node --harmony ./${pathUtil.join(edition.directory || '.', edition.test)} --joe-reporter=console`
			const versions = new Versions(supportedNodeVersions.concat((edition.targets && edition.targets.node) || []))
			await versions.load()
			await versions.install()
			const numbers = versions.map((version) => version.version)
			await versions.test(test)
			const passed = versions.json.passed || []
			const failed = versions.json.failed || []

			// cleaning, as otherwise the second run will treat it differntly
			if (!edition.targets || !edition.targets.node) {
				edition.engines.node = true
			}

			// update the sets
			const passedUnique = passed.filter((version) => versionsAlreadySupported.has(nodeMajorVersion(version)) === false)
			const failedUnique = failed.filter((version) => versionsAlreadySupported.has(nodeMajorVersion(version)) === false)
			const failedRequired = edition.engines.node === true
				? []
				: failedUnique.filter((version) => semver.satisfies(version, edition.engines.node))
			const targetedUnique = edition.engines.node === true
				? passedUnique
				: passedUnique.filter((version) => semver.satisfies(version, edition.engines.node))

			// log the results
			console.log([
				`passed:    ${passed.join(', ')}`,
				`unique:    ${passedUnique.join(', ')}`,
				`failed:    ${failed.join(', ')}`,
				`unique:    ${failedUnique.join(', ')}`,
				`required:  ${failedRequired.join(', ')}`,
				`supports:  ${targetedUnique.join(', ')}`
			].join('\n'))

			// error if unsuccessful
			if (passed.length === 0) {
				console.error(versions.messages.join('\n\n'))
				throw new Error(`The edition [${edition.directory}] had no node versions [${numbers.join(', ')}] which its tests passed`)
			}

			// error if unsuccesful for required
			if (failedRequired.length) {
				console.error(versions.messages.join('\n\n'))
				throw new Error(`The edition [${edition.directory}] with engines [${edition.engines.node}] needed to support [${failedRequired.join(', ')}] but failed on [${failed.join(', ')}]`)
			}

			// make engines the passed versions
			edition.engines.node = nodeMajorVersions(passed).join(' || ')

			// if edition is redundant, mark it as inactive, and mark runtime as needing to be recompiled
			if (targetedUnique.length === 0) {
				console.log(`The edition [${edition.directory}] had no unique node versions that it targeted, so will been trimmed`)
				edition.active = false
				recompile = true
				continue
			}

			// add the unique versions to the list
			passedUnique.forEach((version) => versionsAlreadySupported.add(nodeMajorVersion(version)))

			// log
			status(`...determined engines for edition [${edition.directory}] as [${edition.engines.node}] against [${numbers.join(', ')}]`)
		}

		// if there has been an editions change, try again with an updated runtime
		if (recompile) {
			return await updateRuntime(state)
		}

		// get the first passing version
		minimumPassingVersion = Array.from(versionsAlreadySupported.values()).sort(versionComparator)[0]
	}

	// =================================
	// update engines.node

	// check if minimum supported node version is still the minimum supported node version
	if (versionComparator(minimumPassingVersion, answers.minimumSupportNodeVersion) !== 0) {
		const message = [
			`The project actually supports the minimum node version ${minimumPassingVersion} which is different than your specified minimum supported node version ${answers.minimumSupportNodeVersion}`,
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
	const { activeEditions, packageData, answers } = state
	if (activeEditions.length) {
		// fetch
		const sourceEdition = state.sourceEdition
		const nodeEdition = state.nodeEdition || sourceEdition
		const browserEdition = state.browserEdition || sourceEdition

		// log
		status('scaffolding edition files...')

		// scaffold edition directories
		await spawn(['mkdir', '-p'].concat(
			activeEditions.map(
				(edition) => edition.directory || '.'
			)
		))

		// move or scaffold edition main path if needed
		if ((await exists(sourceEdition.mainPath)) === false) {
			// edition entry doesn't exist, but the root entry does
			if (await exists(sourceEdition.main)) {
				await rename(sourceEdition.main, sourceEdition.mainPath)
			}
			// edition entry doesn't exist, but it is a docpad plugin
			else if (answers.docpadPlugin) {
				write(sourceEdition.mainPath, [
					"'use strict'",
					'',
					"module.exports = class MyPlugin extends require('docpad-baseplugin') {",
					"\tget name () { return 'myplugin' }",
					'\tget initialConfig () { return {} }',
					'}',
					''
				].join('\n'))
			}
			// edition entry doesn't exist, so create an empty file
			else await spawn(['touch', sourceEdition.mainPath])
		}

		// move or scaffold edition test path if needed
		if (answers.docpadPlugin === false) {
			if ((await exists(sourceEdition.testPath)) === false) {
				// edition entry doesn't exist, but the root entry does
				if (await exists(sourceEdition.test)) {
					await rename(sourceEdition.test, sourceEdition.testPath)
				}
				// edition entry doesn't exist, so create a basic test file
				else {
					await write(sourceEdition.testPath, [
						"'use strict'",
						'',
						"const {equal} = require('assert-helpers')",
						"const joe = require('joe')",
						'',
						`joe.suite('${packageData.name}', function (suite, test) {`,
						"\ttest('no tests yet', function () {",
						"\t\tconsole.log('no tests yet')",
						'\t})',
						'})',
						''
					].join('\n'))
				}
			}
		}

		// setup main and test paths
		if (state.useEditionAutoloader) {
			// this is the case for any language that requires compilation
			await write('index.js', [
				"'use strict'",
				'',
				`/** @type {typeof import("./${sourceEdition.mainPath}") } */`,
				"module.exports = require('editions').requirePackage(__dirname, require)",
				''
			].join('\n'))
			packageData.main = 'index.js'

			// don't both with docpad plugins
			if (answers.docpadPlugin === false) {
				await write('test.js', [
					"'use strict'",
					'',
					`/** @type {typeof import("./${sourceEdition.testPath}") } */`,
					`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.test}')`,
					''
				].join('\n'))
				state.test = 'test.js'
			}
		}
		// delete the edition autoloader if it is not needed
		else {
			if (await contains('index.js', 'requirePackage')) {
				await unlink('index.js')
			}
			if (await contains('test.js', 'requirePackage')) {
				await unlink('test.js')
			}

			packageData.main = nodeEdition.mainPath
			state.test = nodeEdition.testPath
		}

		// browser path
		if (answers.browser) {
			packageData.browser = pathUtil.join(browserEdition.directory || '.', browserEdition.main)
		}
		else {
			delete packageData.browser
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
		'projectz': packageData.name === 'projectz' ? false : 'dev',
		'assert-helpers': false,
		'joe': false,
		'joe-reporter-console': false,
		'editions': state.useEditionAutoloader,
		'surge': false,
		'now': false,
		'babel-cli': false,
		'babel-core': false,
		'babel-preset-es2015': false,
		'babel-preset-env': false,
		'@babel/cli': false,
		'@babel/core': false,
		'@babel/preset-env': false,
		'@babel/preset-typescript': false,
		'@babel/plugin-proposal-class-properties': false,
		'@babel/plugin-proposal-object-rest-spread': false,
		'typescript': false,
		'typescript-eslint-parser': false,
		'valid-directory': false,
		'documentation': false,
		'jsdoc': false,
		'minami': false,
		'typedoc': false,
		'flow-bin': false,
		'coffee-script': false,
		'yuidocjs': false,
		'biscotto': false,
		'eslint': false,
		'docpad-baseplugin': false,
		'docpad-plugintester': false,
		'stylelint': false,
		'stylelint-config-standard': false,
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
			'our:clean': 'rm -Rf ./docs ./edition* ./es2015 ./es5 ./out',
			'our:meta:projectz': packageData.name === 'projectz' ? './bin.js compile' : 'projectz compile',
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

	// add the various scripts
	if (answers.docpadPlugin) {
		packages['docpad-baseplugin'] = true
		packages['docpad-plugintester'] = packages.docpad = 'dev'
		state.scripts.test = 'docpad-plugintester'
		if (packageData.peerDependencies) {
			// it is readded later, @todo why?
			delete packageData.peerDependencies.docpad
		}
	}
	else if (answers.docpadWebsite) {
		packages.docpad = 'dev'
		state.scripts.test = 'docpad generate --env static'
	}
	if (answers.languages.has('css')) {
		packages.stylelint = 'dev'
		packages['stylelint-config-standard'] = 'dev'
		state.scripts['our:verify:stylelint'] = `stylelint --fix './${answers.sourceDirectory}/**/*.css'`
	}
	if (answers.languages.has('coffeescript')) {
		packages.coffeelint = 'dev'
		state.scripts['our:verify:coffeelint'] = `coffeelint ./${answers.sourceDirectory}`
	}
	if (answers.languages.has('esnext') || answers.languages.has('typescript')) {
		packages.eslint = 'dev'
		state.scripts['our:verify:eslint'] = `eslint --fix ./${answers.sourceDirectory}/**`
	}
	if (answers.languages.has('typescript')) {
		packages.typescript = packages['typescript-eslint-parser'] = 'dev'
	}
	if (answers.docs) {
		if (answers.language === 'typescript') {
			packages.typedoc = 'dev'
			state.scripts['our:meta:docs'] = `typedoc --name "$npm_package_name" --readme ./README.md --out ./docs ./${answers.sourceDirectory}`
		}
		else if (answers.language === 'coffescript') {
			if (packageData.devDependencies.biscotto) {
				packages.biscotto = 'dev'
				state.scripts['our:meta:biscotto'] = `biscotto -n "$npm_package_name" --title "$npm_package_name API Documentation" --readme README.md --output-dir ./docs ./${answers.sourceDirectory} - LICENSE.md HISTORY.md`
			}
			else {
				packages.yuidocjs = 'dev'
				state.scripts['our:meta:yuidoc'] = `yuidoc -o ./docs --syntaxtype coffee -e .coffee ./${answers.sourceDirectory}`
			}
		}
		else if (answers.language === 'esnext') {
			packages.jsdoc = 'dev'
			packages.minami = 'dev'
			state.scripts['our:meta:docs'] = 'rm -Rf ./docs && jsdoc --recurse --pedantic --access all --destination ./docs --package ./package.json --readme ./README.md --template ./node_modules/minami ./source && mv ./docs/$npm_package_name/$npm_package_version/* ./docs/ && rm -Rf ./docs/$npm_package_name/$npm_package_version'
		}
	}
	if (answers.flowtype) {
		packages['flow-bin'] = 'dev'
		state.scripts['our:verify:flow'] = 'flow check'
	}
	if (state.babelEditions.length) {
		packages['@babel/core'] = packages['@babel/cli'] = packages['@babel/preset-env'] = 'dev'
	}
	if (answers.language === 'typescript') {
		packages['@babel/core'] =
			packages['@babel/preset-typescript'] =
			packages['@babel/plugin-proposal-class-properties'] =
			packages['@babel/plugin-proposal-object-rest-spread'] =
			'dev'
	}
	if (answers.deploy) {
		if (answers.deploy === 'surge') {
			packages.surge = 'dev'
			state.scripts['my:deploy'] = `surge ./${answers.deployDirectory}`
		}
		else if (answers.deploy.startsWith('now')) {
			packages.now = 'dev'
		}
	}
	if (answers.docs) {
		packages.surge = 'dev'
	}
	if (!answers.docpadPlugin && !answers.website) {
		packages.joe = packages['joe-reporter-console'] = packages['assert-helpers'] = 'dev'
	}
	if (!answers.website) {
		packages['valid-directory'] = 'dev'
		state.scripts['our:verify:directory'] = 'npx valid-directory'
	}

	// remove old scripts
	delete state.scripts['our:setup:docpad']

	// write the package.json file
	await writePackage(state)

	// install the development dependencies
	const addDependencies = Object.keys(packages).filter((key) => packages[key] === true)
	const addDevDependencies = Object.keys(packages).filter((key) => packages[key] === 'dev')
	const removeDependencies = Object.keys(packages).filter((key) => packages[key] === false && (packageData.dependencies[key] || packageData.devDependencies[key]))
	if (addDependencies.length) {
		status('adding the dependencies...')
		const command = ['npm', 'install', '--save'].concat(addLatest(addDependencies))
		console.log(command.join(' '))
		await spawn(command)
		status('...added the dependencies')
	}
	if (addDevDependencies.length) {
		status('adding the development dependencies...')
		const command = ['npm', 'install', '--save-dev'].concat(addLatest(addDevDependencies))
		console.log(command.join(' '))
		await spawn(command)
		status('...added the development dependencies')
	}
	if (removeDependencies.length) {
		status('remove old dependencies...')
		const command = ['npm', 'uninstall', '-SDO'].concat(removeDependencies)
		console.log(command.join(' '))
		await spawn(command)
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
		'.jscrc',
		'docpad-setup.sh',
		'.babelrc',
		'tsconfig.json'
	].map((file) => unlink(file)))
	status('...removed old files')

	if (answers.language === 'typescript') {
		status('writing tsconfig file...')
		const tsconfig = {
			compilerOptions: {
				// Target latest version of ECMAScript.
				target: 'esnext',
				// Search under node_modules for non-relative imports.
				moduleResolution: 'node',
				// Process & infer types from .js files.
				allowJs: true,
				// Don't emit; allow Babel to transform files.
				noEmit: true,
				// Enable strictest settings like strictNullChecks & noImplicitAny.
				strict: true,
				// Disallow features that require cross-file information for emit.
				isolatedModules: true,
				// Import non-ES modules as default imports.
				esModuleInterop: true
			},
			include: [
				answers.sourceDirectory
			]
		}
		await write('tsconfig.json', JSON.stringify(tsconfig, null, '  ') + '\n')
		status('...wrote tsconfig file')
	}

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

	// this will get written at a later point
	if (answers.docpadPlugin) {
		if (packageData.peerDependencies == null) {
			packageData.peerDependencies = {}
		}
		packageData.peerDependencies.docpad = '^6.82.0'
	}

	// continue
	await updateEngines(state)

	// log
	status('...updated runtime')

}

module.exports = { updateRuntime }
