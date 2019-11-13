/* eslint no-console:0 no-use-before-define:0 */
'use strict'

// Local
const { status } = require('./log')
const { without, uniq } = require('./util')
const { spawn, exec, write, unlink, exists, rename, contains } = require('./fs')
const { readPackage, writePackage } = require('./package')
const { versionComparator } = require('./versions')

// External
const pathUtil = require('path')
const { Versions } = require('@bevry/testen')

// Consts
const commands = {
	yarn: {
		add: ['yarn', 'add', '--ignore-engines'],
		install: ['yarn', 'install', '--ignore-engines'],
		uninstall: ['yarn', 'remove', '--ignore-engines'],
		pnp: ['yarn', '--pnp', '--ignore-engines'],
		disablepnp: ['yarn', '--disable-pnp', '--ignore-engines']
	},
	npm: {
		add: ['npm', 'install'],
		install: ['npm', 'install'],
		uninstall: ['npm', 'uninstall']
	}
}

// Helpers
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
		? value
				.split('.')
				.slice(0, 2)
				.join('.')
		: value.split('.')[0]
}
function nodeMajorVersions(array) {
	return array.map(version => nodeMajorVersion(version))
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
		const numbers = versions.map(version => version.version)
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
			await versions.test(test, serial)
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
					`The edition [${edition.directory}] had no unique versions which it passed, so it will been trimmed`
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

	// make the engines the first passed version
	packageData.engines.node = '>=' + passed[0]

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
		if (sourceEdition.mainPath) {
			if ((await exists(sourceEdition.mainPath)) === false) {
				// edition entry doesn't exist, but the root entry does
				if (await exists(sourceEdition.main)) {
					await rename(sourceEdition.main, sourceEdition.mainPath)
				}
				// edition entry doesn't exist, but it is a docpad plugin
				else if (answers.docpadPlugin) {
					await write(
						sourceEdition.mainPath,
						[
							useStrict(answers.modules),
							exportOrExports(
								"class MyPlugin extends require('docpad-baseplugin') {",
								answers.modules
							),
							"\tget name () { return 'myplugin' }",
							'\tget initialConfig () { return {} }',
							'}',
							''
						].join('\n')
					)
				}
				// edition entry doesn't exist, so create an empty file
				else
					await write(
						sourceEdition.mainPath,
						[
							useStrict(answers.modules),
							exportOrExports("'@todo'", answers.modules),
							''
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
								useStrict(answers.modules),
								importOrRequire('{equal}', 'assert-helpers', answers.modules),
								importOrRequire('kava', 'kava', answers.modules),
								'',
								`kava.suite('${packageData.name}', function (suite, test) {`,
								"\ttest('no tests yet', function () {",
								"\t\tconsole.log('no tests yet')",
								'\t})',
								'})',
								''
							].join('\n')
						)
					} else {
						await write(
							sourceEdition.testPath,
							[
								useStrict(answers.modules),
								exportOrExports("'@todo'", answers.modules),
								''
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
						`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.test}')`,
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
						`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.bin}')`,
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
			if (answers.modules) {
				packageData.module = packageData.browser
			}
		} else {
			delete packageData.browser
			delete packageData.module
		}

		// log
		status('...scaffolded edition files')
	}
	// no editions
	else {
		if (answers.mainEntry) {
			packageData.main = answers.mainEntry + '.js'
		}
		if (answers.browser) {
			packageData.browser = packageData.main
			if (answers.modules) {
				packageData.module = packageData.browser
			}
		} else {
			delete packageData.browser
			delete packageData.module
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
	const { answers, packageData, sourceEdition } = state

	// prepare
	const sourcePath =
		!answers.sourceDirectory || answers.sourceDirectory === '.'
			? `.`
			: `./${answers.sourceDirectory}`
	const mdx = answers.languages.includes('mdx')
	const run = `${answers.packageManager} run`

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
		'babel-plugin-add-module-exports': false,
		typescript: false,
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

	// Override the versions that are installed if these dependencies are needed
	const versions = {
		next: 'canary',
		now: 'canary',
		'@zeit/next-typescript': 'canary',
		'@zeit/next-mdx': 'canary'
	}

	// b/c compat
	if (answers.minimumSupportNodeVersion < 8) {
		versions['assert-helpers'] = 4
		versions.safeps = 7
		versions.taskgroup = 5
		versions.rimraf = 2
		versions['lazy-require'] = 2
		versions.safefs = 4
		versions.cson = 5
	}
	if (answers.name === 'taskgroup') {
		versions.ambi = 3
	}

	// add our default scripts
	state.scripts = {
		'our:setup:install': commands[answers.packageManager].install.join(' '),
		'our:clean': 'rm -Rf ./docs ./edition* ./es2015 ./es5 ./out ./.next',
		'our:meta:projectz':
			packageData.name === 'projectz' ? './bin.js compile' : 'projectz compile',
		'our:test': [`${run} our:verify`, `${answers.packageManager} test`].join(
			' && '
		),
		'our:release:prepare': [
			`${run} our:clean`,
			`${run} our:compile`,
			`${run} our:test`,
			`${run} our:meta`
		].join(' && '),
		'our:release:push': 'git push origin master && git push origin --tags',
		'our:release': `${run} our:release:push`
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
			'our:release': `${run} our:release:prepare && ${run} our:release:check-changelog && ${run} our:release:check-dirty && ${run} our:release:tag && ${run} our:release:push`
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
			packages['stylelint-config-standard'] = 'dev'
			state.scripts['our:verify:stylelint'] = [
				'stylelint',
				'--fix',
				`'${sourcePath}/**/*.css'`
			].join(' ')
			packageData.stylelint = {
				extends: 'stylelint-config-standard',
				rules: {
					'at-rule-empty-line-before': null,
					'custom-property-empty-line-before': null,
					'declaration-empty-line-before': null,
					indentation: 'tab',
					'max-empty-lines': 2,
					'no-descending-specificity': null,
					'no-duplicate-selectors': null,
					'rule-empty-line-before': null,
					'selector-list-comma-newline-after': null
				},
				ignoreFiles: ['**/vendor/*.css', 'node_modules']
			}
			if (answers.languages.includes('jsx')) {
				// jsx compatibility
				Object.assign(packageData.stylelint.rules, {
					'block-closing-brace-empty-line-before': null,
					'block-closing-brace-newline-after': null,
					'block-closing-brace-newline-before': null,
					'block-closing-brace-space-before': null,
					'block-opening-brace-newline-after': null,
					'block-opening-brace-space-after': null,
					'block-opening-brace-space-before': null,
					'declaration-block-semicolon-newline-after': null,
					'declaration-block-semicolon-space-after': null,
					'declaration-block-semicolon-space-before': null,
					'declaration-block-trailing-semicolon': null
				})
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
			singleQuote: true
		}
		state.scripts['our:verify:eslint'] = [
			'eslint',
			'--fix',
			"--ignore-pattern '**/*.d.ts'",
			"--ignore-pattern '**/vendor/'",
			"--ignore-pattern '**/node_modules/'",
			'--ext .mjs,.js,.jsx,.ts,.tsx',
			sourcePath
		].join(' ')
	}

	// prettier
	if (packages.prettier) {
		state.scripts['our:verify:prettier'] = `prettier --write ${sourcePath}/**`
	}

	// typescript
	if (answers.languages.includes('typescript')) {
		packages.typescript = packages[
			'@typescript-eslint/eslint-plugin'
		] = packages['@typescript-eslint/parser'] = 'dev'
		state.scripts['our:verify:typescript'] = 'tsc --noEmit --project .'
	}

	// Types
	// define the possible locations
	const typePaths = [
		// e.g. index.d.ts
		pathUtil.join(answers.mainEntry + '.d.ts'),
		// e.g. source/index.d.ts
		sourceEdition &&
			pathUtil.join(sourceEdition.directory, answers.mainEntry + '.d.ts'),
		// e.g. source/index.ts
		answers.language === 'typescript' && sourceEdition && sourceEdition.mainPath
	].filter(v => v)
	// fetch their existing status and convert back into the original location
	const typePathsExisting = await Promise.all(
		typePaths.map(v => exists(v).then(e => e && v))
	)
	// find the first location that exists
	const typePath = typePathsExisting.find(v => v)
	// and if exists, apply to types
	if (typePath) {
		packageData.types = typePath
	} else {
		delete packageData.types
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
		tools.forEach(function(tool) {
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
						'--name "$npm_package_name"',
						'--readme ./README.md',
						`--out ${out}`,
						sourcePath
					)
					break
				case 'jsdoc':
					packages.jsdoc = 'dev'
					packages.minami = 'dev'
					parts.push(
						'jsdoc',
						'--recurse',
						'--pedantic',
						'--access all',
						`--destination ${out}`,
						'--package ./package.json',
						'--readme ./README.md',
						'--template ./node_modules/minami',
						'./source',
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
			state.scripts[`our:meta:docs:${tool}`] = parts.filter(v => v).join(' ')
		})
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
	if (answers.website) {
		// surge
		if (answers.website === 'surge') {
			packages.surge = 'dev'
			state.scripts['my:deploy'] = `surge ./${answers.staticDirectory}`
		}
		// now
		else if (answers.nowWebsite) {
			packages.now = 'dev'
			// next / react
			if (answers.website.includes('next')) {
				Object.assign(state.scripts, {
					'now-build': `${run} our:compile:next`,
					'our:compile:next': 'next build',
					start: `${run} our:verify && next dev`
				})
				packages.next = 'dev'
				if (answers.languages.includes('typescript')) {
					packages['@types/next'] = packages['@zeit/next-typescript'] = 'dev'
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

	// package
	if (answers.npm) {
		packages['valid-directory'] = 'dev'
		state.scripts['our:verify:directory'] = 'npx valid-directory'
	}

	// remove self
	packages[packageData.name] = false

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
	function latestDependencies(array) {
		return array.filter(item => !versions[item]).map(item => `${item}@latest`)
	}
	function exactDependencies(array) {
		return array
			.filter(item => versions[item])
			.map(item => `${item}@${versions[item]}`)
	}
	function uninstallRaw(dependencies) {
		if (!dependencies.length) return
		const command = []
		const flags = []
		if (answers.packageManager === 'yarn') {
			// yarn can only uninstall installed deps
			// https://github.com/yarnpkg/yarn/issues/6919
			dependencies = dependencies.filter(
				dependency =>
					packageData.dependencies[dependency] ||
					packageData.devDependencies[dependency]
			)
			if (!dependencies.length) return
			// s = silent
			flags.push('s')
			command.push(...commands.yarn.uninstall)
		} else if (answers.packageManager === 'npm') {
			// S = save
			flags.push('S')
			command.push(...commands.npm.uninstall)
		}
		command.push(...dependencies)
		if (flags.length) command.push('-' + flags.join(''))
		console.log(command.join(' '))
		return spawn(command)
	}
	function uninstall(dependencies) {
		return uninstallRaw(dependencies)
	}
	function installRaw(dependencies, mode, exact = false) {
		if (!dependencies.length) return
		const command = []
		const flags = []
		if (mode === 'development') flags.push('D')
		if (exact) flags.push('E')
		if (answers.packageManager === 'yarn') {
			// s = silent
			flags.push('s')
			command.push(...commands.yarn.add)
		} else if (answers.packageManager === 'npm') {
			// S = save
			// P = production
			flags.push('S')
			if (mode !== 'development') flags.push('P')
			command.push(...commands.npm.add)
		}
		command.push(...dependencies)
		if (flags.length) command.push('-' + flags.join(''))
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

	// remove old files
	status('removing old files...')
	await Promise.all(
		[
			'.babelrc',
			'.eslintrc.js',
			'.jscrc',
			'.jshintrc',
			'.stylelintrc.js',
			'Cakefile',
			'cyclic.js',
			'docpad-setup.sh',
			'esnextguardian.js',
			'nakefile.js',
			'next.config.js',
			'tsconfig.json'
		]
			.filter(i => i)
			.map(file => unlink(file))
	)
	status('...removed old files')

	// joe to kava
	if (
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

	// tsconfig
	if (answers.languages.includes('typescript')) {
		// based from
		// https://blogs.msdn.microsoft.com/typescript/2018/08/27/typescript-and-babel-7/
		// https://github.com/zeit/next-plugins/tree/master/packages/next-typescript
		// https://github.com/Microsoft/TypeScript/issues/29056#issuecomment-448386794
		// Only enable isolatedModules on TypeScript projects, as for JavaScript projects it will be incompatible with 'use strict'
		// resolveJsonModule seems to cause too many issues, so is disabled unless needed
		status('writing tsconfig file...')
		const tsconfig = answers.website
			? {
					compilerOptions: {
						allowJs: true,
						allowSyntheticDefaultImports: true,
						jsx: 'preserve',
						lib: ['dom', 'esnext'],
						maxNodeModuleJsDepth: 5,
						module: 'commonjs',
						moduleResolution: 'node',
						sourceMap: true,
						strict: true,
						target: 'esnext'
					},
					include: uniq([
						'client',
						'pages',
						'scripts',
						'server',
						'shared',
						answers.staticDirectory
					])
			  }
			: {
					compilerOptions: {
						allowJs: true,
						esModuleInterop: true,
						isolatedModules: answers.language === 'typescript',
						maxNodeModuleJsDepth: 5,
						moduleResolution: 'node',
						noEmit: true,
						strict: true,
						target: 'esnext'
					},
					include: [answers.sourceDirectory]
			  }
		// website
		if (answers.website) {
			// next website
			if (answers.website.includes('next')) {
				// next.config.js
				const next = [
					`const withTypescript = require('@zeit/next-typescript')`,
					mdx ? `const withMDX = require('@zeit/next-mdx')` : '',
					`module.exports = ${mdx ? 'withMDX(' : ''}withTypescript({`,
					`	target: 'serverless'`,
					`})${mdx ? ')' : ''}`
				].filter(i => i)
				await write('next.config.js', next.join('\n') + '\n')

				// .babelrc
				const babel = {
					presets: ['next/babel', '@zeit/next-typescript/babel']
				}
				await write('.babelrc', JSON.stringify(babel, null, '  ') + '\n')
			}
		}
		await write('tsconfig.json', JSON.stringify(tsconfig, null, '  ') + '\n')
		status('...wrote tsconfig file')
	}

	// yarn pnp
	if (answers.packageManager === 'yarn') {
		status('yarn enabling plug and play...')
		await spawn(commands.yarn.pnp)
		status('...yarn enabled plug and play')
	}

	// remove deps
	if (removeDependencies.length) {
		status('remove old dependencies...')
		await uninstall(removeDependencies)
		status('...removed old dependencies')
	}

	// upgrade deps
	if (answers.upgradeAllDependencies && answers.packageManager === 'npm') {
		status('upgrading the installed dependencies...')
		try {
			await spawn(['ncu', '-u'])
		} catch (err) {
			await spawn(['npm', 'install', '-g', 'npm-check-updates'])
			await spawn(['ncu', '-u'])
		}
		status('...upgraded all the installed dependencies')
	}

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

	// run setup
	status('running setup...')
	await spawn(`${run} our:setup`)
	status('...ran setup')

	// yarn pnp
	if (answers.packageManager === 'yarn' && answers.nowWebsite) {
		status('yarn disabling plug and play...')
		await spawn(commands.yarn.disablepnp)
		status('...yarn disabled plug and play')
	}

	// run clean
	status('running clean...')
	await spawn(`${run} our:clean`)
	status('...ran clean')

	// run compile
	status('running compile...')
	await spawn(`${run} our:compile`)
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
