/* eslint no-console:0 no-use-before-define:0 */
'use strict'

// Local
const { status } = require('./log')
const { without } = require('./util')
const { spawn, exec, write, unlink, exists, rename, contains } = require('./fs')
const { readPackage, writePackage } = require('./package')
const { versionComparator } = require('./versions')
const { getAnswers } = require('./answers')
const { equal } = require('assert-helpers')

// External
const pathUtil = require('path')
const { Versions } = require('@bevry/testen')

// Helpers
function nodeMajorVersion(value) {
	return value.startsWith('0')
		? value
				.split('.')
				.slice(0, 2)
				.join('.')
		: value.split('.')[0]
}
function nodeMajorVersions(array) {
	return array.map(version => nodeMajorVersion(version))
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
async function updateEngines(state) {
	const { answers, supportedNodeVersions, nodeVersions, packageData } = state
	const nodeEditions = state.nodeEditions
	const allPassedVersions = new Set()

	// =================================
	// run each edition against the supported node version
	// to fetch the engines for each edition

	if (nodeEditions.length === 0) {
		// this can be the case if it is a website
		status('determining engines for project...')
		const versions = new Versions(nodeVersions)
		await versions.load()
		await versions.install()
		const numbers = versions.map(version => version.version)
		await versions.test('npm test')
		const passed = versions.json.passed || []
		if (passed.length === 0) {
			console.error(versions.messages.join('\n\n'))
			throw new Error(
				`There were no node versions [${numbers.join(
					', '
				)}] which the project's tests passed`
			)
		} else {
			packageData.engines.node = nodeMajorVersions(passed).join(' || ')
		}

		// add the versions to the list
		passed.forEach(version => allPassedVersions.add(nodeMajorVersion(version)))

		// log
		status(
			`...determined engines for project as [${
				packageData.engines.node
			}] against [${numbers.join(', ')}]`
		)
	} else {
		let recompile = false

		/* eslint no-loop-func:0 */
		for (const edition of nodeEditions) {
			status(`determining engines for edition [${edition.directory}]...`)

			// Fetch the target and the range
			const target =
				(edition.targets && nodeMajorVersion(edition.targets.node)) || null

			// determine the test script for the edition
			const test = answers.docpadPlugin
				? `docpad-plugintester --edition=${edition.directory}`
				: `node ./${pathUtil.join(edition.directory || '.', edition.test)}`

			// set the versions to test on as the supported node versions,
			// and the target node version
			const versions = new Versions(supportedNodeVersions.concat(target || []))

			// install and test the versions
			await versions.load()
			await versions.install()
			const numbers = versions.map(version => version.version)
			await versions.test(test)
			const passed = versions.json.passed || []
			const failed = versions.json.failed || []

			// update the sets
			const passedUnique = passed.filter(
				version => allPassedVersions.has(nodeMajorVersion(version)) === false
			)
			const failedUnique = failed.filter(
				version => allPassedVersions.has(nodeMajorVersion(version)) === false
			)
			const trim = passedUnique.length === 0
			const range = nodeMajorVersions(passed).join(' || ')

			// log the results
			console.log(
				[
					`target:      ${target || '*'}`,
					`passed:      ${passed.join(', ')}`,
					`.unique:     ${passedUnique.join(', ')}`,
					`failed:      ${failed.join(', ')}`,
					`.unique:     ${failedUnique.join(', ')}`,
					`range:       ${range}`,
					`trim:        ${trim ? 'yes' : 'no'}`
				].join('\n')
			)

			// error if unsuccessful
			if (passed.length === 0) {
				console.error(versions.messages.join('\n\n'))
				throw new Error(
					`The edition [${
						edition.directory
					}] had no node versions [${numbers.join(
						', '
					)}] which its tests passed`
				)
			}

			// error if target failed
			if (
				typeof target === 'string' &&
				nodeMajorVersions(failed).includes(target)
			) {
				console.error(versions.messages.join('\n\n'))
				throw new Error(
					`The edition [${edition.directory}] failed on its target [${target}]`
				)
			}

			// trim
			if (trim) {
				console.log(
					`The edition [${
						edition.directory
					}] had no unique versions which it passed, so it will been trimmed`
				)
				edition.active = false
				recompile = true
				continue
			}

			// make engines the passed versions
			edition.engines.node = range

			// add the unique versions to the list
			passedUnique.forEach(version =>
				allPassedVersions.add(nodeMajorVersion(version))
			)

			// log
			status(
				`...determined engines for edition [${edition.directory}] as [${
					edition.engines.node
				}] against [${numbers.join(', ')}]`
			)
		}

		// if there has been an editions change, try again with an updated runtime
		if (recompile) {
			return await updateRuntime(state)
		}
	}

	// =================================
	// update engines.node

	const passed = Array.from(allPassedVersions.values()).sort(versionComparator)
	const supported = Array.from(supportedNodeVersions.values()).sort(
		versionComparator
	)
	const unsupported = without(supported, passed)
	const extra = without(passed, supported)

	if (unsupported.length) {
		throw new Error(
			`The project does not support the required versions: ${unsupported.join(
				', '
			)}`
		)
	}
	if (extra.length) {
		console.log(`The project supports the extra versions: ${extra.join(', ')}`)
	}

	if (answers.website && passed.length === 1) {
		packageData.engines.node = passed[0]
	} else {
		packageData.engines.node = '>=' + passed[0]
	}

	// =================================
	// update the package.json file

	await writePackage(state)
}

async function scaffoldEditions(state) {
	const { activeEditions, packageData, answers } = state
	if (activeEditions.length) {
		// fetch
		const sourceEdition = state.sourceEdition
		const nodeEdition = state.nodeEdition || sourceEdition
		const browserEdition = state.browserEdition || sourceEdition

		// log
		status('scaffolding edition files...')

		// scaffold edition directories
		await spawn(
			['mkdir', '-p'].concat(
				activeEditions.map(edition => edition.directory || '.')
			)
		)

		// move or scaffold edition main path if needed
		if ((await exists(sourceEdition.mainPath)) === false) {
			// edition entry doesn't exist, but the root entry does
			if (await exists(sourceEdition.main)) {
				await rename(sourceEdition.main, sourceEdition.mainPath)
			}
			// edition entry doesn't exist, but it is a docpad plugin
			else if (answers.docpadPlugin) {
				write(
					sourceEdition.mainPath,
					[
						"'use strict'",
						'',
						"module.exports = class MyPlugin extends require('docpad-baseplugin') {",
						"\tget name () { return 'myplugin' }",
						'\tget initialConfig () { return {} }',
						'}',
						''
					].join('\n')
				)
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
					await write(
						sourceEdition.testPath,
						[
							"'use strict'",
							'',
							"const {equal} = require('assert-helpers')",
							`const kava = require('kava')`,
							'',
							`kava.suite('${packageData.name}', function (suite, test) {`,
							"\ttest('no tests yet', function () {",
							"\t\tconsole.log('no tests yet')",
							'\t})',
							'})',
							''
						].join('\n')
					)
				}
			}
		}

		// setup main and test paths
		if (state.useEditionAutoloader) {
			// this is the case for any language that requires compilation
			await write(
				'index.js',
				[
					"'use strict'",
					'',
					`/** @type {typeof import("./${sourceEdition.mainPath}") } */`,
					"module.exports = require('editions').requirePackage(__dirname, require)",
					''
				].join('\n')
			)
			packageData.main = 'index.js'

			// don't bother with docpad plugins
			if (answers.docpadPlugin === false) {
				await write(
					'test.js',
					[
						"'use strict'",
						'',
						`/** @type {typeof import("./${sourceEdition.testPath}") } */`,
						`module.exports = require('editions').requirePackage(__dirname, require, '${
							nodeEdition.test
						}')`,
						''
					].join('\n')
				)
				state.test = 'test.js'
			}

			// bin
			if (answers.binEntry) {
				await write(
					'index.js',
					[
						"'use strict'",
						'',
						`/** @type {typeof import("./${sourceEdition.binPath}") } */`,
						`module.exports = require('editions').requirePackage(__dirname, require, '${
							nodeEdition.bin
						}')`,
						''
					].join('\n')
				)
				packageData.bin = 'bin.js'
			}
		}
		// delete the edition autoloader if it is not needed
		else {
			if (
				(await exists('index.js')) &&
				(await contains('index.js', 'requirePackage'))
			) {
				await unlink('index.js')
			}
			if (
				(await exists('test.js')) &&
				(await contains('test.js', 'requirePackage'))
			) {
				await unlink('test.js')
			}

			packageData.main = nodeEdition.mainPath
			state.test = nodeEdition.testPath
		}

		// browser path
		if (answers.browser) {
			packageData.browser = pathUtil.join(
				browserEdition.directory || '.',
				browserEdition.main
			)
		} else {
			delete packageData.browser
		}

		// log
		status('...scaffolded edition files')
	} else {
		if (answers.mainEntry) {
			packageData.main = answers.mainEntry + '.js'
		}
		if (answers.browser) {
			packageData.browser = packageData.main
		} else {
			delete packageData.browser
		}
		if (answers.testEntry) {
			state.test = answers.testEntry + '.js'
		}
		if (answers.binEntry) {
			packageData.bin = answers.binEntry + '.js'
		}
	}
}

// Update runtime
async function updateRuntime(state) {
	const { answers, packageData } = state

	// prepare
	const sourcePath =
		answers.sourceDirectory === '.' ? `.` : `./${answers.sourceDirectory}`
	const sourceGlob =
		sourcePath === '.'
			? answers.language === 'typescript'
				? '**/*.ts'
				: '**/*.js'
			: `${sourcePath}/**/*.*`

	// log
	status('updating runtime...')

	// =================================
	// editions

	await scaffoldEditions(state)

	// =================================
	// scripts and dependencies

	/** @type {Object.<string, boolean | string>} */
	const packages = {
		projectz: 'dev',
		'assert-helpers': false,
		joe: false,
		kava: false,
		'kava-examples': false,
		'kava-reporter-console': false,
		'kava-reporter-list': false,
		editions: state.useEditionAutoloader,
		surge: false,
		now: false,
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
		'babel-plugin-add-module-exports': false,
		typescript: false,
		'typescript-eslint-parser': false,
		prettier: false,
		eslint: false,
		'babel-eslint': false,
		'eslint-config-bevry': false,
		'eslint-config-prettier': false,
		'eslint-plugin-prettier': false,
		'eslint-plugin-typescript': false,
		'eslint-plugin-react': false,
		'eslint-plugin-flow-vars': false,
		'valid-directory': false,
		documentation: false,
		jsdoc: false,
		minami: false,
		typedoc: false,
		'flow-bin': false,
		'coffee-script': false,
		yuidocjs: false,
		biscotto: false,
		'docpad-baseplugin': false,
		'docpad-plugintester': false,
		stylelint: false,
		'stylelint-config-standard': false,
		coffeelint: false,
		coffeescript:
			packageData.devDependencies.coffeescript ||
			packageData.devDependencies['coffee-script']
				? 'dev'
				: packageData.dependencies.coffeescript ||
				  packageData.dependencies['coffee-script']
				? true
				: answers.languages === 'coffeescript'
				? 'dev'
				: false
	}
	const versions = {}

	// add our default scripts
	state.scripts = {
		'our:setup:npm': 'npm install',
		'our:clean': 'rm -Rf ./docs ./edition* ./es2015 ./es5 ./out',
		'our:meta:projectz':
			packageData.name === 'projectz' ? './bin.js compile' : 'projectz compile',
		'our:test': ['npm run our:verify', 'npm test'].join(' && '),
		'our:release:prepare': [
			'npm run our:clean',
			'npm run our:compile',
			'npm run our:test',
			'npm run our:meta'
		].join(' && '),
		'our:release:push': 'git push origin master && git push origin --tags',
		'our:release': 'npm run our:release:push',
		test: `node ./${state.test}`
	}

	// add our package scripts
	if (answers.npm)
		Object.assign(state.scripts, {
			'our:release:check-changelog':
				'cat ./HISTORY.md | grep v$npm_package_version || (echo add a changelog entry for v$npm_package_version && exit -1)',
			'our:release:check-dirty': 'git diff --exit-code',
			'our:release:tag':
				'export MESSAGE=$(cat ./HISTORY.md | sed -n "/## v$npm_package_version/,/##/p" | sed \'s/## //\' | awk \'NR>1{print buf}{buf = $0}\') && test "$MESSAGE" || (echo \'proper changelog entry not found\' && exit -1) && git tag v$npm_package_version -am "$MESSAGE"',
			'our:release:push': 'git push origin master && git push origin --tags',
			'our:release':
				'npm run our:release:prepare && npm run our:release:check-changelog && npm run our:release:check-dirty && npm run our:release:tag && npm run our:release:push'
		})

	// docpad plugin
	if (answers.docpadPlugin) {
		packages['docpad-baseplugin'] = true
		packages['docpad-plugintester'] = packages.docpad = 'dev'
		state.scripts.test = 'docpad-plugintester'
		if (packageData.peerDependencies) {
			// it is read later, @todo why?
			delete packageData.peerDependencies.docpad
		}
	}
	// docpad website
	else if (answers.docpadWebsite) {
		packages.docpad = true
		state.scripts.test = 'docpad generate --env static'
	}

	// css
	if (answers.languages.includes('css')) {
		packages.stylelint = 'dev'
		packages['stylelint-config-standard'] = 'dev'
		state.scripts['our:verify:stylelint'] = [
			'stylelint',
			'--fix',
			`'${sourcePath}/**/*.css'`
		].join(' ')
	}

	// coffeescript
	if (answers.languages.includes('coffeescript')) {
		packages.coffeelint = 'dev'
		state.scripts['our:verify:coffeelint'] = [
			'coffeelint',
			`${sourcePath}`
		].join(' ')
	}

	// javascript
	if (
		answers.languages.includes('esnext') ||
		answers.languages.includes('typescript')
	) {
		packages.eslint = 'dev'
	}

	// eslint
	if (packages.eslint) {
		packages.prettier = packages['eslint-config-prettier'] = packages[
			'eslint-plugin-prettier'
		] = 'dev'
		if (answers.name === 'eslint-config-bevry') {
			packageData.eslintConfig = {
				extends: ['./local.js']
			}
		} else {
			packageData.eslintConfig = {
				extends: ['bevry']
			}
			packages['eslint-config-bevry'] = 'dev'
		}
		packageData.prettier = {
			semi: false,
			singleQuote: true
		}
		state.scripts['our:verify:eslint'] = [
			'eslint',
			'--fix',
			"--ignore-pattern '**/*.d.ts'",
			"--ignore-pattern '**/vendor/'",
			"--ignore-pattern '**/node_modules/'",
			'--ext .mjs,.js,.jsx,.ts,.tsx',
			`'${sourceGlob}'`
		].join(' ')
	}

	// typescript
	if (answers.languages.includes('typescript')) {
		packages.typescript = packages['eslint-plugin-typescript'] = packages[
			'typescript-eslint-parser'
		] = 'dev'
		state.scripts['our:verify:typescript'] = 'tsc --project .'
	}
	if (answers.language === 'typescript') {
		state.scripts['our:compile:types'] =
			'tsc --isolatedModules false --noEmit false --allowJs false --declaration  --emitDeclarationOnly --outFile index --project .'
		packageData.types = 'index.d.ts'
	} else {
		delete packageData.types
	}

	// documentation
	if (answers.docs) {
		// typescript
		if (answers.languages.includes('typescript')) {
			packages.typedoc = 'dev'
			// https://github.com/TypeStrong/typedoc/issues/913
			if (answers.language !== 'typescript') {
				versions.typedoc = 'TypeStrong/typedoc'
			}
			state.scripts['our:meta:docs:typedoc'] = [
				'rm -Rf ./docs',
				'&&',
				'typedoc',
				// use includeDeclarations if we are not a typescript project
				answers.language === 'typescript' ? '' : '--includeDeclarations',
				'--mode file',
				"--exclude '**/+(*test*|node_modules)/**'",
				'--name "$npm_package_name"',
				'--readme ./README.md',
				'--out ./docs',
				`${sourcePath}`
			]
				.filter(v => v)
				.join(' ')
		}
		// coffeescript
		if (answers.languages.includes('coffescript')) {
			// biscotto
			if (packageData.devDependencies.biscotto) {
				packages.biscotto = 'dev'
				state.scripts['our:meta:docs:biscotto'] = [
					'rm -Rf ./docs',
					'&&',
					'biscotto',
					'-n "$npm_package_name"',
					'--title "$npm_package_name API Documentation"',
					'--readme README.md',
					'--output-dir ./docs',
					`${sourcePath}`,
					'- LICENSE.md HISTORY.md'
				].join(' ')
			}
			// yuidoc
			else {
				packages.yuidocjs = 'dev'
				state.scripts['our:meta:docs:yuidoc'] = [
					'rm -Rf ./docs',
					'&&',
					'yuidoc',
					'-o ./docs',
					'--syntaxtype coffee',
					'-e .coffee',
					`${sourcePath}`
				]
			}
		}
		// esnext
		if (answers.languages.includes('esnext')) {
			packages.jsdoc = 'dev'
			packages.minami = 'dev'
			state.scripts['our:meta:docs:jsdoc'] = [
				'rm -Rf ./docs',
				'&&',
				'jsdoc',
				'--recurse',
				'--pedantic',
				'--access all',
				'--destination ./docs',
				'--package ./package.json',
				'--readme ./README.md',
				'--template ./node_modules/minami',
				'./source',
				'&&',
				'mv ./docs/$npm_package_name/$npm_package_version/* ./docs/',
				'&&',
				'rm -Rf ./docs/$npm_package_name/$npm_package_version'
			].join(' ')
		}
	}

	// flowtype
	if (answers.flowtype) {
		packages['eslint-plugin-flow-vars'] = packages['flow-bin'] = 'dev'
		state.scripts['our:verify:flow'] = 'flow check'
	}

	// babel
	if (state.babelEditions.length) {
		packages['@babel/core'] = packages['@babel/cli'] = packages[
			'@babel/preset-env'
		] = packages['@babel/plugin-proposal-object-rest-spread'] = 'dev'
	}

	// typescript
	if (answers.language === 'typescript') {
		packages['@babel/core'] = packages['@babel/preset-typescript'] = packages[
			'@babel/plugin-proposal-class-properties'
		] = packages['@babel/plugin-proposal-object-rest-spread'] = packages[
			'babel-plugin-add-module-exports'
		] = 'dev'
	}

	// deploy
	if (answers.deploy) {
		// surge
		if (answers.deploy === 'surge') {
			packages.surge = 'dev'
			state.scripts['my:deploy'] = `surge ./${answers.deployDirectory}`
		}
		// now
		else if (answers.deploy.startsWith('now')) {
			packages.now = 'dev'
		}
	}

	// deploy: documentation
	if (answers.docs) {
		packages.surge = 'dev'
	}

	// testing (not docpad plugin, nor website)
	if (!answers.docpadPlugin && !answers.website) {
		packages.kava = packages['assert-helpers'] = 'dev'
	}

	// package
	if (answers.npm) {
		packages['valid-directory'] = 'dev'
		state.scripts['our:verify:directory'] = 'npx valid-directory'
	}

	// remove self
	packages[packageData.name] = false

	// remove old scripts
	delete state.scripts['our:setup:docpad']

	// write the package.json file
	await writePackage(state)

	// handle the dependencies
	const addDependencies = Object.keys(packages).filter(
		key => packages[key] === true
	)
	const addDevDependencies = Object.keys(packages).filter(
		key => packages[key] === 'dev'
	)
	const removeDependencies = Object.keys(packages).filter(
		key =>
			packages[key] === false &&
			(packageData.dependencies[key] || packageData.devDependencies[key])
	)

	// helper
	function addVersion(array) {
		return array.map(item => `${item}@${versions[item] || 'latest'}`)
	}

	// remove deps
	if (removeDependencies.length) {
		status('remove old dependencies...')
		const command = ['npm', 'uninstall', '-SDO'].concat(removeDependencies)
		console.log(command.join(' '))
		await spawn(command)
		status('...removed old dependencies')
	}
	// add deps
	if (addDependencies.length) {
		status('adding the dependencies...')
		const command = ['npm', 'install', '--save'].concat(
			addVersion(addDependencies)
		)
		console.log(command.join(' '))
		await spawn(command)
		status('...added the dependencies')
	}
	// add dev deps
	if (addDevDependencies.length) {
		status('adding the development dependencies...')
		const command = ['npm', 'install', '--save-dev'].concat(
			addVersion(addDevDependencies)
		)
		console.log(command.join(' '))
		await spawn(command)
		status('...added the development dependencies')
	}

	// upgrade deps
	if (answers.upgradeAllDependencies) {
		status('upgrading the installed dependencies...')
		try {
			await spawn(['ncu', '-u'])
		} catch (err) {
			await spawn(['npm', 'install', '-g', 'npm-check-updates'])
			await spawn(['ncu', '-u'])
		}
		status('...upgraded all the installed dependencies')
	}

	// install remaining
	status('installing the dependencies...')
	await spawn(['npm', 'install'])
	status('...installed all the dependencies')

	// remove old files
	status('removing old files...')
	await Promise.all(
		[
			'.babelrc',
			'.eslintrc.js',
			'.jscrc',
			'.jshintrc',
			'Cakefile',
			'cyclic.js',
			'docpad-setup.sh',
			'esnextguardian.js',
			'nakefile.js',
			'tsconfig.json'
		].map(file => unlink(file))
	)
	status('...removed old files')

	// joe to kava
	if (
		packageData.devDependencies.joe &&
		packageData.name !== 'kava' &&
		answers.website === false
	) {
		status('renaming joe to kava...')
		await exec(
			`bash -O nullglob -O globstar -c "sed -i '' -e 's/joe/kava/g' ${sourceGlob}"`
		)
		status('...renamed joe to kava')
	}

	// tsconfig
	if (answers.languages.includes('typescript')) {
		status('writing tsconfig file...')
		const tsconfig = {
			// https://blogs.msdn.microsoft.com/typescript/2018/08/27/typescript-and-babel-7/
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
				isolatedModules: answers.language === 'typescript',
				// Import non-ES modules as default imports.
				esModuleInterop: true,
				// Allow .ts files to make use of jsdoc'd .js files.
				// https://github.com/Microsoft/TypeScript/issues/29056#issuecomment-448386794
				maxNodeModuleJsDepth: 5
			},
			include: [answers.sourceDirectory]
		}
		await write('tsconfig.json', JSON.stringify(tsconfig, null, '  ') + '\n')
		status('...wrote tsconfig file')
	}

	// run setup
	status('running setup...')
	await spawn('npm run our:setup')
	status('...ran setup')

	// run clean
	status('running clean...')
	await spawn('npm run our:clean')
	status('...ran clean')

	// run compile
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
