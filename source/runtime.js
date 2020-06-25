/* eslint no-console:0 no-use-before-define:0 */
'use strict'

// External
const pathUtil = require('path')
const { Versions } = require('@bevry/testen')

// Local
const { status } = require('./log.js')
const { allEsTargets, allLanguages, bustedVersions } = require('./data.js')
const { parse } = require('./fs.js')
const {
	without,
	uniq,
	toggle,
	fixTsc,
	getPreviousVersion,
	getDuplicateDeps,
} = require('./util.js')
const {
	contains,
	exec,
	exists,
	rename,
	spawn,
	unlink,
	write,
} = require('./fs.js')
const { readPackage, writePackage } = require('./package.js')
const { versionComparator } = require('./versions.js')

// Consts
const commands = {
	yarn: {
		add: ['yarn', 'add', '--ignore-engines'],
		install: ['yarn', 'install', '--ignore-engines'],
		upgrade: ['yarn', 'upgrade', '--ignore-engines'],
		uninstall: ['yarn', 'remove', '--ignore-engines'],
		pnp: ['yarn', '--pnp', '--ignore-engines'],
		disablepnp: ['yarn', '--disable-pnp', '--ignore-engines'],
	},
	npm: {
		add: ['npm', 'install'],
		install: ['npm', 'install'],
		uninstall: ['npm', 'uninstall'],
	},
}

async function upgradePackageDependencies(install) {
	try {
		return await spawn(['ncu', '-u'])
	} catch (err) {
		if (install) {
			return Promise.reject(err)
		} else {
			await spawn(['npm', 'i', '-g', 'npm-check-updates'])
			upgradePackageDependencies(true)
		}
	}
}

// Helpers
function updateEditionEntries({
	answers,
	nodeEdition,
	browserEdition,
	packageData,
}) {
	// node
	if (answers.node) {
		if (nodeEdition) {
			packageData.node = browserEdition.nodePath
		} else {
			packageData.node = answers.nodeEntry + '.js'
		}
	} else {
		delete packageData.node
	}
	// browser
	if (answers.browser) {
		if (browserEdition) {
			packageData.browser = browserEdition.browserPath
			if (answers.sourceModule) {
				packageData.module = packageData.browser
			}
		} else {
			packageData.browser = answers.browserEntry + '.js'
			if (answers.sourceModule) {
				packageData.module = packageData.browser
			}
		}
	} else {
		delete packageData.browser
		delete packageData.module
	}
}
function binEntry(answers, binEntry) {
	if (answers.binExecutable) {
		if (answers.binExecutable === answers.name) {
			return binEntry
		} else {
			const result = {}
			for (const executable of answers.binExecutable.split(/,\s*/)) {
				result[executable] = binEntry
			}
			return result
		}
	}
	return null
}
function peerDepInstallLocation(packageData, key) {
	return (packageData.peerDependencies || {})[key] ? 'dev' : true
}
function nodeMajorVersion(value) {
	if (typeof value === 'number') {
		value = String(value)
	} else if (typeof value !== 'string') {
		return null
	}
	return value.startsWith('0')
		? value.split('.').slice(0, 2).join('.')
		: value.split('.')[0]
}
function nodeMajorVersions(array) {
	return array.map((version) => nodeMajorVersion(version))
}
function importOrRequire(left, right, modules = true) {
	return modules
		? `import ${left} from '${right}'`
		: `const ${left} = require('${modules}')`
}
function exportOrExports(content, modules = true) {
	return modules ? `export default ${content}` : `module.exports = ${content}`
}
function useStrict(modules = true) {
	return modules ? '' : "'use strict'\n"
}

// Update engines
async function updateEngines(state) {
	const { answers, supportedNodeVersions, nodeVersions, packageData } = state
	const nodeEditions = state.nodeEditions
	const allPassedVersions = new Set()
	const serial = ['testen', 'safefs', 'lazy-require'].includes(answers.name)

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
		await versions.test(`${answers.packageManager} test`, serial)
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
		passed.forEach((version) =>
			allPassedVersions.add(nodeMajorVersion(version))
		)

		// log
		status(
			`...determined engines for project as [${
				packageData.engines.node
			}] against [${numbers.join(', ')}]`
		)
	} else {
		let recompile = false
		let skip = false
		let debug = ''

		/* eslint no-loop-func:0 */
		for (const edition of nodeEditions) {
			if (skip) {
				console.log(
					`The edition [${edition.directory}] will be trimmed, as a previous edition already passes all targets`
				)
				edition.active = false
				recompile = true
				continue
			}

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
			const numbers = versions.map((version) => version.version)
			await versions.test(test, serial)
			const passed = versions.json.passed || []
			const failed = versions.json.failed || []

			// update the sets
			const passedUnique = passed.filter(
				(version) => allPassedVersions.has(nodeMajorVersion(version)) === false
			)
			const failedUnique = failed.filter(
				(version) => allPassedVersions.has(nodeMajorVersion(version)) === false
			)
			const trim = passedUnique.length === 0
			const range = nodeMajorVersions(passed).join(' || ')
			skip = failed.length === 0

			// log the results
			debug += versions.messages.join('\n\n')
			console.log(
				[
					`target:      ${target || '*'}`,
					`passed:      ${passed.join(', ')}`,
					`.unique:     ${passedUnique.join(', ')}`,
					`failed:      ${failed.join(', ')}`,
					`.unique:     ${failedUnique.join(', ')}`,
					`range:       ${range}`,
					`trim:        ${trim ? 'yes' : 'no'}`,
				].join('\n')
			)

			// trim
			if (trim) {
				console.log(
					`The edition [${edition.directory}] will be trimmed, as it has no unique passing versions`
				)
				edition.active = false
				recompile = true
				continue
			}

			// make engines the passed versions
			edition.engines.node = range

			// add the unique versions to the list
			passedUnique.forEach((version) =>
				allPassedVersions.add(nodeMajorVersion(version))
			)

			// log
			status(
				`...determined engines for edition [${edition.directory}] as [${
					edition.engines.node
				}] against [${numbers.join(', ')}]`
			)
		}

		// verify we have editions that pass on our targets
		for (const version of supportedNodeVersions) {
			if (!allPassedVersions.has(version)) {
				console.error(debug.trim())
				throw new Error(
					`No editions passed for required node version [${version}]`
				)
			}
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

	// if we are testing all supported versions
	// then make the engines the first passed version
	if (answers.minimumSupportNodeVersion >= answers.minimumTestNodeVersion) {
		packageData.engines.node = '>=' + passed[0]
	} else {
		// otherwise use the supported version, as all our tests passed
		packageData.engines.node = '>=' + answers.minimumSupportNodeVersion
	}

	// =================================
	// update the package.json file

	await writePackage(state)
}

async function scaffoldEditions(state) {
	// fetch
	const {
		sourceEdition,
		nodeEdition,
		activeEditions,
		packageData,
		answers,
	} = state

	// handle
	if (activeEditions.length) {
		// log
		status('scaffolding edition files...')

		// scaffold edition directories
		await spawn(
			['mkdir', '-p'].concat(
				activeEditions.map((edition) => edition.directory || '.')
			)
		)

		// move or scaffold edition main path if needed
		if (sourceEdition.indexPath) {
			if ((await exists(sourceEdition.indexPath)) === false) {
				// edition entry doesn't exist, but the root entry does
				if (await exists(sourceEdition.main)) {
					await rename(sourceEdition.main, sourceEdition.indexPath)
				}
				// edition entry doesn't exist, but it is a docpad plugin
				else if (answers.docpadPlugin) {
					await write(
						sourceEdition.indexPath,
						[
							useStrict(answers.sourceModule),
							exportOrExports(
								"class MyPlugin extends require('docpad-baseplugin') {",
								answers.sourceModule
							),
							"\tget name () { return 'myplugin' }",
							'\tget initialConfig () { return {} }',
							'}',
							'',
						].join('\n')
					)
				}
				// edition entry doesn't exist, so create an empty file
				else
					await write(
						sourceEdition.indexPath,
						[
							useStrict(answers.sourceModule),
							exportOrExports("'@todo'", answers.sourceModule),
							'',
						].join('\n')
					)
			}
		}

		// move or scaffold edition test path if needed
		if (sourceEdition.testPath) {
			if (answers.docpadPlugin === false) {
				if ((await exists(sourceEdition.testPath)) === false) {
					// edition entry doesn't exist, but the root entry does
					if (await exists(sourceEdition.test)) {
						await rename(sourceEdition.test, sourceEdition.testPath)
					}
					// edition entry doesn't exist, so create a basic test file
					else if (answers.kava) {
						await write(
							sourceEdition.testPath,
							[
								useStrict(answers.sourceModule),
								importOrRequire(
									'{equal}',
									'assert-helpers',
									answers.sourceModule
								),
								importOrRequire('kava', 'kava', answers.sourceModule),
								'',
								`kava.suite('${packageData.name}', function (suite, test) {`,
								"\ttest('no tests yet', function () {",
								"\t\tconsole.log('no tests yet')",
								'\t})',
								'})',
								'',
							].join('\n')
						)
					} else {
						await write(
							sourceEdition.testPath,
							[
								useStrict(answers.sourceModule),
								exportOrExports("'@todo'", answers.sourceModule),
								'',
							].join('\n')
						)
					}
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
					`/** @type {typeof import("./${sourceEdition.indexPath}") } */`,
					"module.exports = require('editions').requirePackage(__dirname, require)",
					'',
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
						`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.test}')`,
						'',
					].join('\n')
				)
				state.test = 'test.js'
			}

			// bin
			if (answers.binEntry) {
				await write(
					'bin.js',
					[
						'#!/usr/bin/env node',
						"'use strict'",
						'',
						`/** @type {typeof import("./${sourceEdition.binPath}") } */`,
						`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.bin}')`,
						'',
					].join('\n')
				)
				packageData.bin = binEntry(answers, 'bin.js')
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
			if (
				(await exists('bin.js')) &&
				(await contains('bin.js', 'requirePackage'))
			) {
				await unlink('bin.js')
			}
			if (answers.binEntry) {
				if (nodeEdition !== sourceEdition) {
					await write(
						'bin.js',
						[
							'#!/usr/bin/env node',
							"'use strict'",
							'',
							...(answers.packageModule
								? [`import './${nodeEdition.binPath}'`]
								: [
										`/** @type {typeof import("./${sourceEdition.binPath}") } */`,
										`module.exports = require('./${nodeEdition.binPath}')`,
								  ]),
							'',
						].join('\n')
					)
					packageData.bin = binEntry(answers, 'bin.js')
				} else {
					if (nodeEdition) {
						// check for websites
						packageData.bin = binEntry(answers, nodeEdition.binPath)
					}
					await unlink('bin.js')
				}
			} else {
				await unlink('bin.js')
			}
			if (nodeEdition) {
				// check for websites
				packageData.main = nodeEdition.entryPath
				state.test = nodeEdition.testPath
			} else {
				delete packageData.main
				delete state.test
			}
		}

		// browser path
		updateEditionEntries(state)

		// log
		status('...scaffolded edition files')
	}
	// no editions
	else {
		if (answers.indexEntry) {
			packageData.main = answers.indexEntry + '.js'
		}
		updateEditionEntries(state)
		if (answers.testEntry) {
			state.test = answers.testEntry + '.js'
		}
		packageData.bin = binEntry(answers, answers.binEntry + '.js')
	}

	// ensure it has permission, necessary for yarn publishing
	if (packageData.bin) {
		status('ensure correct bin permission...')
		const bins = (typeof packageData.bin === 'string'
			? packageData.bin
			: Object.values(packageData.bin)
		).map((i) => `./${i}`)
		await spawn(['chmod', '+x', ...bins])
		status('...ensured correct bin permission')
	}
}

// Update runtime
async function updateRuntime(state) {
	const { answers, packageData, sourceEdition } = state

	// prepare
	const sourcePath =
		!answers.sourceDirectory || answers.sourceDirectory === '.'
			? `.`
			: `./${answers.sourceDirectory}`
	const mdx = answers.languages.includes('mdx')
	const run = [answers.packageManager, 'run']
	const test = [answers.packageManager, 'test']
	const extension = answers.language === 'typescript' ? '.ts' : '.js'

	// log
	status('updating runtime...')

	// =================================
	// editions

	await scaffoldEditions(state)

	// =================================
	// dependencies fixes

	// Override the versions that are installed if these dependencies are needed
	const versions = {
		// next: 'canary',
		// now: 'canary',
		// '@zeit/next-typescript': 'canary',
		// '@zeit/next-mdx': 'canary',
	}

	// apply busted version fixes
	for (const [key, version] of Object.entries(bustedVersions)) {
		versions[key] = getPreviousVersion(version, 0, 2)
	}

	// fix currupted states
	let duplicateDepNames = getDuplicateDeps(packageData)
	for (const key of duplicateDepNames) {
		delete packageData.dependencies[key]
		delete packageData.devDependencies[key]
	}

	// fix deps that are in deps and devDeps
	if (duplicateDepNames.length) {
		console.log(
			`the following dependencies existed in both deps and devDeps:`,
			duplicateDepNames
		)
		// continue backtracking until we find a version that doesn't have the issue
		let cmd,
			out,
			version = packageData.version
		while (true) {
			// prepare
			const nextVersion = getPreviousVersion(version, 0, 1)
			if (version === nextVersion) {
				throw new Error(
					`unable to rever to a previous version that did not have duplicate packages, please fix the duplication of the following packages manually: ${duplicateDepNames.join(
						', '
					)}`
				)
			}
			version = nextVersion
			// dev deps
			cmd = `npm view --json --no-color ${packageData.name}@${version} devDependencies`
			out = (await exec(cmd)).trim()
			if (!out) {
				// continue backwards, as there should definitely be dev deps, so this version failed
				continue
			}
			const devDeps = JSON.parse(out)
			packageData.devDependencies = devDeps
			console.log(`used [${cmd}] to restore devDeps to`, devDeps)
			// deps
			cmd = `npm view --json --no-color ${packageData.name}@${version} dependencies`
			out = (await exec(cmd)).trim()
			const deps = JSON.parse(out || '{}')
			packageData.dependencies = deps
			console.log(`used [${cmd}] to restore deps to`, deps)
			// if we solved the problem, then break
			duplicateDepNames = getDuplicateDeps(packageData)
			if (duplicateDepNames.length === 0) break
		}
	}

	// write the package.json file
	await writePackage(state)

	// =================================
	// scripts and dependencies

	/** @type {Object.<string, boolean | string>} */
	const packages = {
		projectz: 'dev',
		'assert-helpers': false,
		joe: false,
		kava: false,
		'joe-examples': false,
		'joe-reporter-console': false,
		'joe-reporter-list': false,
		editions: state.useEditionAutoloader,
		surge: false,
		now: false,
		next: false,
		'@zeit/next-typescript': false,
		'next-server': false,
		'@types/next': false,
		'@types/react': false,
		'@types/react-dom': false,
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
		'@babel/plugin-proposal-optional-chaining': false,
		'babel-plugin-add-module-exports': false,
		typescript: false,
		'make-deno-edition': false,
		'typescript-eslint-parser': false,
		'@typescript-eslint/parser': false,
		prettier: false,
		eslint: false,
		'babel-eslint': false,
		'eslint-config-bevry': false,
		'eslint-config-prettier': false,
		'eslint-plugin-flow-vars': false,
		'eslint-plugin-prettier': false,
		'eslint-plugin-react-hooks': false,
		'eslint-plugin-react': false,
		'eslint-plugin-typescript': false,
		'@typescript-eslint/eslint-plugin': false,
		'valid-directory': false,
		'valid-module': false,
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
				: false,
	}

	// b/c compat
	const dependencyCompat = {
		cson: 5,
		rimraf: 2,
		safefs: 4,
		safeps: 7,
		taskgroup: 5,
		'cli-spinners': 1,
		'lazy-require': 2,
	}
	const devDependencyCompat = {
		kava: 3,
		'assert-helpers': 4,
	}
	if (answers.minimumSupportNodeVersion < 8) {
		for (const [key, value] of Object.entries(dependencyCompat)) {
			versions[key] = value
		}
	}
	if (answers.minimumTestNodeVersion < 8) {
		for (const [key, value] of Object.entries(devDependencyCompat)) {
			versions[key] = value
		}
	}

	// add user overrides
	Object.assign(
		versions,
		(packageData &&
			packageData.boundation &&
			packageData.boundation.versions) ||
			{}
	)

	// add our default scripts
	state.scripts = {
		'our:setup:install': commands[answers.packageManager].install.join(' '),
		'our:clean': 'rm -Rf ./docs ./edition* ./es2015 ./es5 ./out ./.next',
		'our:meta:projectz':
			packageData.name === 'projectz' ? 'npx . compile' : 'projectz compile',
		'our:test': [[...run, 'our:verify'], test]
			.map((i) => i.join(' '))
			.join(' && '),
		'our:release:prepare': [
			[...run, 'our:clean'],
			[...run, 'our:compile'],
			[...run, 'our:test'],
			[...run, 'our:meta'],
		]
			.map((i) => i.join(' '))
			.join(' && '),
		'our:release:push': 'git push origin master && git push origin --tags',
		'our:release': [...run, 'our:release:push'].join(' '),
	}

	// add test script
	if (state.test) {
		state.scripts.test = `node ./${state.test}`
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
			'our:release': [
				[...run, 'our:release:prepare'],
				[...run, 'our:release:check-changelog'],
				[...run, 'our:release:check-dirty'],
				[...run, 'our:release:tag'],
				[...run, 'our:release:push'],
			]
				.map((i) => i.join(' '))
				.join(' && '),
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
		if (answers.nowWebsite) {
			state.scripts['our:verify:stylelint'] =
				"echo 'disabled due to https://spectrum.chat/zeit/general/resolved-deployments-fail-with-enospc-no-space-left-on-device-write~d1b9f61a-65e8-42a3-9042-f9c6a6fae6fd'"
		} else {
			packages.stylelint = 'dev'
			packages['stylelint-config-prettier'] = packages[
				'stylelint-config-standard'
			] = 'dev'
			state.scripts['our:verify:stylelint'] = [
				'stylelint',
				'--fix',
				`'${sourcePath}/**/*.css'`,
			].join(' ')
			packageData.stylelint = {
				extends: [
					'stylelint-config-standard',
					'stylelint-prettier/recommended',
				],
				plugins: ['stylelint-prettier'],
				ignoreFiles: ['**/vendor/*.css', 'node_modules'],
			}
		}
	}

	// coffeescript
	if (answers.languages.includes('coffeescript')) {
		packages.coffeelint = 'dev'
		state.scripts['our:verify:coffeelint'] = ['coffeelint', sourcePath].join(
			' '
		)
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
		if (!packageData.eslintConfig) packageData.eslintConfig = {}
		if (answers.name === 'eslint-config-bevry') {
			packageData.eslintConfig.extends = ['./local.js']
		} else {
			packageData.eslintConfig.extends = ['bevry']
			packages['eslint-config-bevry'] = 'dev'
		}
		packageData.prettier = {
			semi: false,
			singleQuote: true,
		}
		state.scripts['our:verify:eslint'] = [
			'eslint',
			'--fix',
			"--ignore-pattern '**/*.d.ts'",
			"--ignore-pattern '**/vendor/'",
			"--ignore-pattern '**/node_modules/'",
			'--ext .mjs,.js,.jsx,.ts,.tsx',
			sourcePath,
		].join(' ')
	}

	// prettier
	if (packages.prettier) {
		state.scripts['our:verify:prettier'] = `prettier --write .`
	}

	// typescript
	// primarily typescript
	if (answers.language === 'typescript') {
		// @todo import make-deno-edition and use the api instead of the bin
		// deno compat layer
		if (answers.sourceModule && answers.npm) {
			if (packageData.name === 'make-deno-edition') {
				// @todo, once make-deno-edition API is used, this can be fixzed
				// it is currently disabled because it cannot call itself during the compile step
				// as it has not finished compiling
				// state.scripts['our:compile:deno'] = 'npx . --attempt'
			} else {
				state.scripts['our:compile:deno'] = 'make-deno-edition --attempt'
				packages['make-deno-edition'] = 'dev'
			}
		}
		// types
		state.scripts['our:compile:types'] = [
			'tsc',
			`--project ${answers.tsconfig}`,
			'--emitDeclarationOnly',
			'--declaration',
			'--declarationMap',
			'--declarationDir ./compiled-types',
			...fixTsc('compiled-types', answers.sourceDirectory),
			// doesn't work: '|| true', // fixes failures where types may be temporarily missing
		]
			.filter((part) => part)
			.join(' ')
		packageData.types = './compiled-types/'
	}
	// partially typescript
	if (answers.languages.includes('typescript')) {
		packages.typescript = packages[
			'@typescript-eslint/eslint-plugin'
		] = packages['@typescript-eslint/parser'] = 'dev'
	}
	// not typescript
	else {
		// Types
		// define the possible locations
		// do note that they must exist throughout boundation, which if it is a compiled dir, is sporadic
		const typePaths = [
			// existing types directory
			packageData.types,
			// e.g. index.d.ts
			pathUtil.join(answers.indexEntry + '.d.ts'),
			// e.g. source/index.d.ts
			sourceEdition &&
				pathUtil.join(sourceEdition.directory, answers.indexEntry + '.d.ts'),
		].filter((v) => v)
		// fetch their existing status and convert back into the original location
		const typePathsExisting = await Promise.all(
			typePaths.map((v) => exists(v).then((e) => e && v))
		)
		// find the first location that exists
		const typePath = typePathsExisting.find((v) => v)
		// and if exists, apply to types
		if (typePath) {
			packageData.types = typePath
		} else {
			delete packageData.types
		}
	}

	// documentation
	if (answers.docs) {
		// Prepare
		const tools = []

		// typescript
		if (answers.languages.includes('typescript')) {
			tools.push('typedoc')
		}
		// coffeescript
		if (answers.languages.includes('coffescript')) {
			// biscotto
			if (packageData.devDependencies.biscotto) {
				tools.push('biscotto')
			}
			// yuidoc
			else {
				tools.push('yuidoc')
			}
		}
		// esnext
		if (answers.languages.includes('esnext')) {
			tools.push('jsdoc')
		}

		// Add the documentation engines
		tools.forEach(function (tool) {
			const out = tools.length === 1 ? './docs' : `./docs/${tool}`
			packages[tool] = 'dev'
			const parts = [`rm -Rf ${out}`, '&&']
			switch (tool) {
				case 'typedoc':
					packages.typedoc = 'dev'
					parts.push(
						'typedoc',
						// use includeDeclarations if we are not a typescript project
						answers.language === 'typescript' ? '' : '--includeDeclarations',
						'--mode file',
						"--exclude '**/+(*test*|node_modules)'",
						'--excludeExternals',
						'--name "$npm_package_name"',
						'--readme ./README.md',
						`--out ${out}`,
						sourcePath
					)
					break
				case 'jsdoc':
					packages.jsdoc = 'dev'
					parts.push(
						'jsdoc',
						'--recurse',
						'--pedantic',
						'--access all',
						`--destination ${out}`,
						'--package ./package.json',
						'--readme ./README.md',
						sourcePath,
						'&&',
						`mv ${out}/$npm_package_name/$npm_package_version/* ${out}/`,
						'&&',
						`rm -Rf ${out}/$npm_package_name/$npm_package_version`
					)
					break
				case 'yuidoc':
					packages.yuidocjs = 'dev'
					parts.push(
						'yuidoc',
						`-o ${out}`,
						'--syntaxtype coffee',
						'-e .coffee',
						sourcePath
					)
					break
				case 'biscotto':
					packages.biscotto = 'dev'
					parts.push(
						'biscotto',
						'-n "$npm_package_name"',
						'--title "$npm_package_name API Documentation"',
						'--readme README.md',
						`--output-dir ${out}`,
						sourcePath,
						'- LICENSE.md HISTORY.md'
					)
					break
				default:
					throw new Error('unknown documentation tool')
			}
			state.scripts[`our:meta:docs:${tool}`] = parts.filter((v) => v).join(' ')
		})
	}

	// flowtype
	if (answers.flowtype) {
		packages['eslint-plugin-flow-vars'] = packages['flow-bin'] = 'dev'
		state.scripts['our:verify:flow'] = 'flow check'
	}

	// edition deps
	for (const edition of state.activeEditions) {
		for (const dep of edition.dependencies) {
			packages[dep] = true
		}
		for (const devDep of edition.devDependencies) {
			packages[devDep] = 'dev'
		}
	}

	// deploy
	if (answers.website) {
		// surge
		if (answers.website === 'surge') {
			packages.surge = 'dev'
			state.scripts[
				'my:deploy'
			] = `surge ./${answers.staticDirectory} ${answers.deployTarget}`
		}
		// now
		else if (answers.nowWebsite) {
			packages.now = 'dev'
			// next / react
			if (answers.website.includes('next')) {
				Object.assign(state.scripts, {
					'now-build': [...run, 'our:compile:next'].join(' '),
					'our:compile:next': 'next build',
					start: [
						[...run, 'our:verify'],
						['next', 'dev'],
					]
						.map((i) => i.join(' '))
						.join(' && '),
				})
				packages.next = 'dev'
				if (answers.languages.includes('typescript')) {
					packages['@types/next'] = 'dev'
				}
			}
		}
	}

	// react
	if (answers.languages.includes('react')) {
		packages.react = packages['react-dom'] = peerDepInstallLocation(
			packageData,
			'react'
		)
		packages['eslint-plugin-react-hooks'] = packages['eslint-plugin-react'] =
			'dev'
		if (answers.languages.includes('typescript')) {
			packages['@types/react'] = packages['@types/react-dom'] = packages.react
		}
	}

	// deploy: documentation
	if (answers.docs) {
		packages.surge = 'dev'
	}

	// testing (not docpad plugin, nor website)
	if (answers.kava) {
		packages.kava = packages['assert-helpers'] = 'dev'
	}

	// browser path
	updateEditionEntries(state)

	// package
	if (answers.npm) {
		if (answers.name !== '@bevry/update-contributors') {
			packages['@bevry/update-contributors'] = 'dev'
			state.scripts['our:meta:contributors'] = 'update-contributors'
		} else {
			state.scripts['our:meta:directory'] = 'npx .'
		}
		if (answers.name !== 'valid-directory') {
			packages['valid-directory'] = 'dev'
			state.scripts['our:verify:directory'] = 'valid-directory'
		} else {
			// do not valid-directory, the valid-directory package
			// as it deliberately has invalid files in it
			// such that it tests can detect that it works
			// state.scripts['our:verify:directory'] = 'npx .'
		}
		if (packageData.module) {
			if (answers.name !== 'valid-module') {
				packages['valid-module'] = 'dev'
				state.scripts['our:verify:module'] = 'valid-module'
			} else {
				state.scripts['our:verify:module'] = 'npx .'
			}
		}
	}

	// keywords
	const allLanguagesLowercase = allLanguages.map((i) => i.toLowerCase())
	const allEsTargetsLowercase = allEsTargets.map((i) => i.toLowerCase())
	const usedTargetsLowercase = state.activeEditions
		.map((e) =>
			Array.from(e.tags).find((t) =>
				allEsTargetsLowercase.includes(t.toLowerCase())
			)
		)
		.filter((i) => i)
		.map((i) => i.toLowerCase())
	const usedLanguagesLowercase = answers.languages.map((i) => i.toLowerCase())
	toggle(answers.keywords, allEsTargetsLowercase, false)
	toggle(answers.keywords, usedTargetsLowercase, true)
	toggle(answers.keywords, allLanguagesLowercase, false)
	toggle(answers.keywords, usedLanguagesLowercase, true)
	// console.log({ usedTargetsLowercase, usedLanguagesLowercase })
	toggle(answers.keywords, 'website', answers.website)
	toggle(
		answers.keywords,
		'node',
		!answers.website && answers.npm && Boolean(answers.desiredNodeVersion)
	)
	toggle(answers.keywords, 'dom', answers.dom)
	toggle(answers.keywords, 'browser', answers.browser)
	toggle(answers.keywords, 'module', packageData.module)
	toggle(
		answers.keywords,
		['types', 'typed'],
		packageData.types || packages.jsdoc
	)
	if (answers.npm && answers.language === 'typescript') {
		try {
			await exec(`cat ${sourceEdition.indexPath} | grep "export default"`)
			answers.keywords.add('export-default')
		} catch (err) {
			answers.keywords.delete('export-default')
		}
	}

	// githubauthquerystring to githubauthreq
	if (packageData.dependencies.githubauthquerystring) {
		packages.githubauthquerystring = false
		packages.githubauthreq = true
	}

	// joe to kava
	if (
		sourcePath !== '.' &&
		answers.type === 'package' &&
		packageData.devDependencies.joe &&
		packageData.name !== 'kava'
	) {
		status('renaming joe to kava...')
		await exec(
			`bash -O nullglob -O globstar -c "sed -i '' -e 's/joe/kava/g' ${sourcePath}/**/*.*"`
		)
		status('...renamed joe to kava')
	}

	// remove self
	packages[packageData.name] = false

	// adjust package.json:type
	// if edition autoloader, or website, then use commonjs regardless
	// as otherwise node scripts will fail
	packageData.type =
		answers.packageModule && !state.useEditionAutoloader ? 'module' : 'commonjs'

	// remove old scripts
	delete state.scripts['our:setup:docpad']

	// ensure specific versions are set
	for (const key of Object.keys(versions)) {
		if (packageData.dependencies[key]) {
			packages[key] = true
		}
		if (packageData.devDependencies[key]) {
			packages[key] = 'dev'
		}
	}

	// write the package.json file
	await writePackage(state)

	// handle the dependencies
	const addDependencies = Object.keys(packages).filter(
		(key) => packages[key] === true
	)
	const addDevDependencies = Object.keys(packages).filter(
		(key) => packages[key] === 'dev'
	)
	const removeDependencies = Object.keys(packages).filter(
		(key) =>
			packages[key] === false &&
			(packageData.dependencies[key] || packageData.devDependencies[key])
	)

	// helper
	function isExact(value) {
		return value && value !== 'latest'
	}
	function latestDependencies(array) {
		return array
			.filter((item) => !isExact(versions[item]))
			.map((item) => `${item}@latest`)
	}
	function exactDependencies(array) {
		return array
			.filter((item) => isExact(versions[item]))
			.map((item) => `${item}@${versions[item]}`)
	}
	function uninstallRaw(dependencies) {
		// only uninstall installed deps
		// for yarn this is necessary: https://github.com/yarnpkg/yarn/issues/6919
		// for npm this is useful
		dependencies = dependencies.filter(
			(dependency) =>
				packageData.dependencies[dependency] ||
				packageData.devDependencies[dependency]
		)
		if (!dependencies.length) return
		// continue
		const command = []
		const args = []
		if (answers.packageManager === 'yarn') {
			args.push('--silent')
			command.push(...commands.yarn.uninstall)
		} else if (answers.packageManager === 'npm') {
			command.push(...commands.npm.uninstall)
		} else {
			throw new Error('unsupported package manager')
		}
		command.push(...args, ...dependencies)
		console.log(command.join(' '))
		return spawn(command)
	}
	function uninstall(dependencies) {
		return uninstallRaw(dependencies)
	}
	function installRaw(dependencies, mode, exact = false) {
		if (!dependencies.length) return
		const command = []
		const args = []
		if (answers.packageManager === 'yarn') {
			args.push('--silent')
			// yarn add --help
			if (exact) args.push('--exact')
			if (mode === 'development') args.push('--dev')
			command.push(...commands.yarn.add)
		} else if (answers.packageManager === 'npm') {
			args.push('--no-fund', '--no-audit')
			if (exact) args.push('--save-exact')
			if (mode === 'development') args.push('--save-dev')
			else args.push('--save-prod')
			command.push(...commands.npm.add)
		} else {
			throw new Error('unsupported package manager')
		}
		command.push(...args, ...dependencies)
		console.log(command.join(' '))
		return spawn(command)
	}
	async function install(dependencies, mode) {
		// if yarn, uninstall first, workaround for https://github.com/yarnpkg/yarn/issues/5345
		if (answers.packageManager === 'yarn') await uninstall(dependencies)
		// continue
		await installRaw(latestDependencies(dependencies), mode)
		await installRaw(exactDependencies(dependencies), mode, true)
	}

	// tsconfig
	if (answers.tsconfig === 'tsconfig.json') {
		// based from
		// https://blogs.msdn.microsoft.com/typescript/2018/08/27/typescript-and-babel-7/
		// https://github.com/zeit/next-plugins/tree/master/packages/next-typescript
		// https://github.com/Microsoft/TypeScript/issues/29056#issuecomment-448386794
		// Only enable isolatedModules on TypeScript projects, as for JavaScript projects it will be incompatible with 'use strict'
		// resolveJsonModule seems to cause too many issues, so is disabled unless needed
		const lib = new Set()
		try {
			const data = await parse(answers.tsconfig)
			const list =
				(data && data.compilerOptions && data.compilerOptions.lib) || []
			// add any lib that has a dot back to lib
			list.filter((i) => i.includes('.')).forEach((i) => lib.add(i))
		} catch (e) {
			// ignore
		}
		status('writing tsconfig file...')
		if (answers.keywords.has('webworker')) lib.add('WebWorker')
		if (answers.keywords.has('dom')) lib.add('DOM').add('DOM.Iterable')
		if (answers.keywords.has('esnext')) lib.add('ESNext')
		const tsconfig = answers.website
			? {
					compilerOptions: {
						allowJs: true,
						allowSyntheticDefaultImports: true,
						jsx: 'preserve',
						lib: Array.from(lib),
						maxNodeModuleJsDepth: 5,
						module: 'ESNext',
						moduleResolution: 'Node',
						sourceMap: true,
						strict: true,
						target: 'ESNext',
						// new props
						skipLibCheck: true,
						forceConsistentCasingInFileNames: true,
						noEmit: true,
						esModuleInterop: true,
						resolveJsonModule: true,
						isolatedModules: true,
					},
					include: uniq([
						'components',
						'pages',
						'public',
						'lib',
						answers.staticDirectory,
					]),
					exclude: ['node_modules'],
			  }
			: {
					compilerOptions: Object.assign(
						{
							allowJs: true,
							esModuleInterop: true,
							isolatedModules: answers.language === 'typescript',
							maxNodeModuleJsDepth: 5,
							moduleResolution: 'Node',
							strict: true,
							target: 'ESNext',
							lib: Array.from(lib),
						},
						answers.packageModule ? { module: 'ESNext' } : {}
					),
					include: [answers.sourceDirectory],
			  }
		if (lib.size === 0) delete tsconfig.compilerOptions.lib
		await write('tsconfig.json', JSON.stringify(tsconfig, null, '  ') + '\n')
		status('...wrote tsconfig file')
	} else {
		// remove tsconfig.json
		unlink('tsconfig.json')
	}

	// next mdx website
	if (answers.website && answers.website.includes('next')) {
		// add directories
		await spawn(['mkdir', '-p', 'components', 'pages/api', 'public', 'lib'])
		// add next.config.js
		if (!(await exists('next.config.js'))) {
			const nextConfigContent =
				[
					mdx ? `const withMDX = require('@zeit/next-mdx')` : '',
					`module.exports = ${mdx ? 'withMDX(' : ''}{`,
					`	target: 'serverless'`,
					`}${mdx ? ')' : ''}`,
				]
					.filter((i) => i)
					.join('\n') + '\n'
			await write('next.config.js', nextConfigContent)
		}
		// add index page
		if (!(await exists(`pages/index${extension}`))) {
			const indexPageContent =
				[
					`import React from 'react'`,
					`function IndexPage() { return <article>hello</article> }`,
					`export default IndexPage`,
				]
					.filter((i) => i)
					.join('\n') + '\n'
			await write(`pages/index${extension}`, indexPageContent)
		}
	}

	// remove deps
	if (removeDependencies.length) {
		status('remove old dependencies...')
		await uninstall(removeDependencies)
		status('...removed old dependencies')
	}

	// status('yarn enabling plug and play...')
	// await spawn(commands.yarn.pnp)
	// status('...yarn enabled plug and play')

	// upgrade deps
	status('upgrading the installed dependencies...')
	// npx -p npm-check-updates takes 14 seconds each time, so install globally instead
	await upgradePackageDependencies()
	// yarn still needs ncu to update package.json
	if (answers.packageManager === 'yarn') {
		await spawn(commands.yarn.install) // necessary to proceed
		await spawn(commands.yarn.upgrade) // updates the lock file
	}
	status('...upgraded the installed dependencies')

	// add deps
	if (addDependencies.length) {
		status('adding the dependencies...')
		await install(addDependencies, 'production')
		status('...added the dependencies')
	}

	// add dev deps
	if (addDevDependencies.length) {
		status('adding the development dependencies...')
		await install(addDevDependencies, 'development')
		status('...added the development dependencies')
	}

	// disable yarn pnp for zeit
	if (answers.packageManager === 'yarn' && answers.nowWebsite) {
		status('yarn disabling plug and play...')
		await spawn(commands.yarn.disablepnp)
		status('...yarn disabled plug and play')
	}

	// run any extra setup steps
	status('running setup...')
	await spawn([...run, 'our:setup'])
	status('...ran setup')

	// run clean
	status('running clean...')
	await spawn([...run, 'our:clean'])
	status('...ran clean')

	// run compile
	status('running compile...')
	await spawn([...run, 'our:compile'])
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
	if (answers.language !== 'json') {
		await updateEngines(state)
	}

	// log
	status('...updated runtime')
}

module.exports = { updateRuntime }
