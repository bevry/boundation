// External
import * as pathUtil from 'path'

// Local
import { status } from './log.js'
import {
	add,
	has,
	strip,
	addExtension,
	fixTsc,
	useStrict,
	exportOrExports,
	importOrRequire,
	binEntry,
} from './util.js'
import { languageNames } from './data.js'
import { spawn, exists, rename, write, contains, unlink } from './fs.js'

// Helpers
class Edition {
	constructor(opts) {
		Object.defineProperty(this, 'targets', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'dependencies', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'devDependencies', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'compiler', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'scripts', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'compiler', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'babel', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'active', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'entry', {
			enumerable: false,
			get() {
				const engines = []
				for (const [name, supported] of Object.entries(this.engines)) {
					if (supported) engines.push(name)
				}
				const entry =
					engines.length !== 1 ? this.index : this[engines[0]] || this.index
				return entry
			},
		})

		Object.defineProperty(this, 'index', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'node', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'browser', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'test', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'bin', {
			enumerable: false,
			writable: true,
		})

		Object.defineProperty(this, 'indexPath', {
			enumerable: false,
			get() {
				return this.index && pathUtil.join(this.directory || '.', this.index)
			},
		})

		Object.defineProperty(this, 'entryPath', {
			enumerable: false,
			get() {
				return this.entry && pathUtil.join(this.directory || '.', this.entry)
			},
		})

		Object.defineProperty(this, 'nodePath', {
			enumerable: false,
			get() {
				return this.node && pathUtil.join(this.directory || '.', this.node)
			},
		})

		Object.defineProperty(this, 'browserPath', {
			enumerable: false,
			get() {
				return (
					this.browser && pathUtil.join(this.directory || '.', this.browser)
				)
			},
		})

		Object.defineProperty(this, 'testPath', {
			enumerable: false,
			get() {
				return this.test && pathUtil.join(this.directory || '.', this.test)
			},
		})

		Object.defineProperty(this, 'binPath', {
			enumerable: false,
			get() {
				return this.bin && pathUtil.join(this.directory || '.', this.bin)
			},
		})

		opts.tags = new Set(opts.tags || [])
		opts.dependencies = new Set(opts.dependencies || [])
		opts.devDependencies = new Set(opts.devDependencies || [])

		Object.assign(this, { scripts: {}, active: true }, opts)
	}
}

// Actions
export async function generateEditions(state) {
	const { answers, packageData } = state

	// log
	status('updating editions...')

	// handle
	if (answers.website) {
		delete packageData.main
		state.editions = [
			new Edition({
				description: 'source',
				directory: '.',
				tags: [
					'website',
					...answers.languages,
					answers.sourceModule ? 'import' : 'require',
				],
			}),
		]
	} else {
		const editions = new Map()

		// Generate base editions based on language
		if (answers.language === 'es5') {
			const edition = new Edition({
				directory: answers.sourceDirectory,
				index: addExtension(answers.indexEntry, `js`),
				node: addExtension(answers.nodeEntry, `js`),
				browser: addExtension(answers.browserEntry, `js`),
				test: addExtension(answers.testEntry, `js`),
				bin: addExtension(answers.binEntry, `js`),
				tags: [
					'javascript',
					'es5',
					answers.sourceModule ? 'import' : 'require',
				],
				engines: {
					node: true,
					browsers: answers.browsers,
				},
			})

			if (answers.flowtype) {
				add(edition.tags, 'flow type comments')
			}

			editions.set('source', edition)
		} else if (answers.language === 'esnext') {
			const edition = new Edition({
				directory: answers.sourceDirectory,
				index: addExtension(answers.indexEntry, `js`),
				node: addExtension(answers.nodeEntry, `js`),
				browser: addExtension(answers.browserEntry, `js`),
				test: addExtension(answers.testEntry, `js`),
				bin: addExtension(answers.binEntry, `js`),
				tags: [
					'javascript',
					'esnext',
					answers.sourceModule ? 'import' : 'require',
				],
				engines: {
					node: true,
					browsers:
						answers.browsers && answers.targets.includes('browser') === false,
				},
			})

			if (answers.flowtype) {
				add(edition.tags, 'flow type comments')
			}

			editions.set('source', edition)
		} else if (answers.language === 'typescript') {
			editions.set(
				'source',
				new Edition({
					directory: answers.sourceDirectory,
					index: addExtension(answers.indexEntry, `ts`),
					node: addExtension(answers.nodeEntry, `ts`),
					browser: addExtension(answers.browserEntry, `ts`),
					test: addExtension(answers.testEntry, `ts`),
					bin: addExtension(answers.binEntry, `js`),
					tags: ['typescript', 'import'],
					engines: false,
				})
			)
		} else if (answers.language === 'coffeescript') {
			editions.set(
				'source',
				new Edition({
					directory: answers.sourceDirectory,
					index: addExtension(answers.indexEntry, `coffee`),
					node: addExtension(answers.nodeEntry, `coffee`),
					browser: addExtension(answers.browserEntry, `coffee`),
					test: addExtension(answers.testEntry, `coffee`),
					bin: addExtension(answers.binEntry, `coffee`),
					tags: ['coffeescript', 'require'],
					engines: false,
				})
			)
		} else if (answers.language === 'json') {
			editions.set(
				'source',
				new Edition({
					description: 'JSON',
					directory: answers.sourceDirectory,
					index: addExtension(answers.indexEntry, `json`),
					node: addExtension(answers.nodeEntry, `json`),
					browser: addExtension(answers.browserEntry, `json`),
					test: addExtension(answers.testEntry, `js`),
					bin: addExtension(answers.binEntry, `js`),
					tags: ['json'],
					engines: {
						node: true,
						browsers:
							answers.browsers && answers.targets.includes('browser') === false,
					},
				})
			)
		} else {
			throw new Error('language should have been defined, but it was missing')
		}

		// Add the compiled editions if necessary
		for (const target of answers.targets) {
			if (target === 'browser') {
				editions.set(
					'browser',
					new Edition({
						compiler: answers.compilerBrowser,
						// for legacy b/c reasons this is not "edition-browser"
						directory: 'edition-browsers',
						index: addExtension(answers.browserEntry, `js`),
						browser: addExtension(answers.browserEntry, `js`),
						test: addExtension(answers.testEntry, `js`),
						bin: addExtension(answers.binEntry, `js`),
						tags: ['javascript', answers.sourceModule ? 'import' : 'require'],
						targets: {
							es: 'ES' + (new Date().getFullYear() - 1), // typescript browser target, set the previous year
							esmodules: answers.sourceModule,
							browsers: answers.browsers,
						},
						engines: {
							node: false,
							browsers: answers.browsers,
						},
					})
				)
			} else if (answers.compilerNode === 'babel') {
				let version
				if (target === 'desired') {
					version = answers.desiredNodeVersion
				} else if (target === 'minimum') {
					version = answers.minimumSupportNodeVersion
				} else if (target === 'maximum') {
					version = answers.maximumSupportNodeVersion
				} else {
					throw new Error(`invalid target: ${target}`)
				}
				editions.set(
					`node-${version}`,
					new Edition({
						compiler: 'babel',
						directory: `edition-node-${version}`,
						index: addExtension(answers.indexEntry, `js`),
						node: addExtension(answers.nodeEntry, `js`),
						browser: addExtension(answers.browserEntry, `js`),
						test: addExtension(answers.testEntry, `js`),
						bin: addExtension(answers.binEntry, `js`),
						tags: ['javascript', answers.packageModule ? 'import' : 'require'],
						targets: {
							node: version,
						},
						engines: {
							node: true,
							browsers: false,
						},
					})
				)
			} else if (answers.compilerNode === 'typescript') {
				const syntax = target.toLocaleLowerCase()
				const directory = `edition-${syntax}`
				editions.set(
					syntax,
					new Edition({
						compiler: 'typescript',
						directory,
						index: addExtension(answers.indexEntry, `js`),
						node: addExtension(answers.nodeEntry, `js`),
						browser: addExtension(answers.browserEntry, `js`),
						test: addExtension(answers.testEntry, `js`),
						bin: addExtension(answers.binEntry, `js`),
						tags: [
							'javascript',
							syntax,
							answers.packageModule ? 'import' : 'require',
						],
						targets: {
							es: target,
						},
						engines: {
							node: true,
							browsers:
								answers.browsers &&
								answers.targets.includes('browser') === false,
						},
					})
				)
			} else if (answers.compilerNode === 'coffeescript') {
				const syntax = target.toLocaleLowerCase()
				const directory = `edition-${syntax}`
				editions.set(
					syntax,
					new Edition({
						compiler: 'coffeescript',
						directory,
						index: addExtension(answers.indexEntry, `js`),
						node: addExtension(answers.nodeEntry, `js`),
						browser: addExtension(answers.browserEntry, `js`),
						test: addExtension(answers.testEntry, `js`),
						bin: addExtension(answers.binEntry, `js`),
						tags: ['javascript', 'esnext', 'require'],
						engines: {
							node: true,
							browsers:
								answers.browsers &&
								answers.targets.includes('browser') === false,
						},
					})
				)
			} else {
				throw new Error(`invalid target: ${target}`)
			}
		}

		// autogenerate various fields
		editions.forEach(function (edition) {
			const browserVersion =
				(edition.targets && edition.targets.browsers) ||
				(edition.engines && edition.engines.browsers)
			const nodeVersion =
				(edition.targets && edition.targets.node) ||
				(edition.engines && edition.engines.node)
			const compileScriptName = `our:compile:${edition.directory}`

			// add compilation details
			if (edition.compiler === 'coffeescript') {
				edition.scripts[
					compileScriptName
				] = `coffee -bco ./${edition.directory} ./${answers.sourceDirectory}`
			} else if (edition.compiler === 'typescript') {
				edition.scripts[compileScriptName] = [
					'tsc',
					has(edition.tags, 'require')
						? '--module commonjs'
						: '--module ESNext',
					`--target ${edition.targets.es}`,
					`--outDir ./${edition.directory}`,
					`--project ${answers.tsconfig}`,
					...fixTsc(edition.directory, answers.sourceDirectory),
					// doesn't work: '|| true', // fixes failures where types may be temporarily missing
				]
					.filter((part) => part)
					.join(' ')
			} else if (edition.compiler === 'babel') {
				if (answers.language === 'coffeescript') {
					// add coffee compile script
					edition.scripts[compileScriptName] = [
						`env BABEL_ENV=${edition.directory}`,
						'coffee -bcto',
						`./${edition.directory}/`,
						`./${answers.sourceDirectory}`,
					]
						.filter((part) => part)
						.join(' ')
				} else {
					// add babel compile script
					edition.scripts[compileScriptName] = [
						`env BABEL_ENV=${edition.directory}`,
						'babel',
						answers.language === 'typescript' ? '--extensions ".ts,.tsx"' : '',
						`--out-dir ./${edition.directory}`,
						`./${answers.sourceDirectory}`,
					]
						.filter((part) => part)
						.join(' ')
				}

				// populate babel
				edition.babel = {
					sourceType: answers.sourceModule ? 'module' : 'script',
					presets: [
						[
							'@babel/preset-env',
							{
								targets: strip(edition.targets, 'es'),
								modules:
									edition.targets.esmodules ||
									answers.sourceModule === answers.packageModule
										? false
										: answers.packageModule
										? 'auto'
										: 'commonjs',
							},
						],
					],
					plugins: ['@babel/proposal-object-rest-spread'],
				}

				add(
					edition.devDependencies,
					'@babel/core',
					'@babel/cli',
					'@babel/preset-env',
					'@babel/plugin-proposal-object-rest-spread'
				)

				if (answers.language === 'typescript') {
					add(edition.babel.presets, '@babel/preset-typescript')
					add(
						edition.babel.plugins,
						'@babel/plugin-proposal-optional-chaining',
						'@babel/proposal-class-properties'
					)
					add(
						edition.devDependencies,
						'@babel/core',
						'@babel/preset-typescript',
						'@babel/plugin-proposal-class-properties',
						'@babel/plugin-proposal-object-rest-spread',
						'@babel/plugin-proposal-optional-chaining'
					)
				}
			}

			// add the package.json type information to the edition
			if (edition.engines.node && edition.scripts[compileScriptName]) {
				const packageType = has(edition.tags, 'require') ? 'commonjs' : 'module'
				edition.scripts[
					compileScriptName
				] += ` && echo '{"type": "${packageType}"} > ${edition.directory}/package.json`
			}

			// ensure description exists
			if (!edition.description) {
				const description = [
					languageNames[answers.language] || answers.language,
					edition.directory === answers.sourceDirectory
						? 'source code'
						: 'compiled',
				]
				if (edition.targets && edition.targets.es) {
					// what the typescript compiler targets
					description.push(`against ${edition.targets.es}`)
				}
				if (browserVersion) {
					description.push(`for web browsers`)
					if (
						typeof browserVersion === 'string' &&
						browserVersion !== 'defaults'
					) {
						description.push(`[${browserVersion}]`)
					}
				}
				if (nodeVersion) {
					description.push(browserVersion ? 'and' : 'for', `Node.js`)
					if (typeof nodeVersion === 'string') {
						// typescript compiler will be true, as typescript doesn't compile to specific node versions
						description.push(`${nodeVersion}`)
					}
				}
				if (has(edition.tags, 'require')) {
					description.push('with Require for modules')
				} else if (has(edition.tags, 'import')) {
					description.push('with Import for modules')
				}
				edition.description = description.join(' ')
			}
		})

		// prepare
		state.editions = Array.from(editions.values())
	}

	// log
	console.log(
		'editions:',
		state.editions.map((edition) => edition.directory).join(', ')
	)
	status('...updated editions')
}

// Helpers
export function updateEditionEntries({
	answers,
	nodeEdition,
	browserEdition,
	packageData,
}) {
	// node
	if (answers.node) {
		if (nodeEdition) {
			packageData.node = nodeEdition.nodePath
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

export async function scaffoldEditions(state) {
	// fetch
	const {
		sourceEdition,
		nodeEdition,
		nodeEditionImport,
		activeEditions,
		packageData,
		answers,
	} = state

	// clean old edition files
	await unlink([
		'bin.js',
		'bin.cjs',
		'bin.mjs',
		'index.js',
		'index.cjs',
		'index.mjs',
		'test.js',
		'test.cjs',
		'test.mjs',
	])

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
				// edition index entry doesn't exist, but it is a docpad plugin
				if (answers.docpadPlugin) {
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
				// edition index entry doesn't exist, so create an empty file
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
					// edition test entry doesn't exist, so create a basic test file
					if (answers.kava) {
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
				'index.cjs',
				[
					"'use strict'",
					'',
					`/** @type {typeof import("./${sourceEdition.indexPath}") } */`,
					"module.exports = require('editions').requirePackage(__dirname, require)",
					'',
				].join('\n')
			)
			packageData.main = 'index.cjs'
			if (nodeEditionImport) {
				await write(
					'index.mjs',
					`export * from './${nodeEditionImport.indexPath}')`
				)
				packageData.main = 'index'
			}

			// don't bother with docpad plugins
			if (answers.docpadPlugin === false) {
				await write(
					'test.cjs',
					[
						"'use strict'",
						'',
						`/** @type {typeof import("./${sourceEdition.testPath}") } */`,
						`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.test}')`,
						'',
					].join('\n')
				)
				state.test = 'test.cjs'
				if (nodeEditionImport) {
					await write(
						'test.mjs',
						`export * from './${nodeEditionImport.testPath}')`
					)
					packageData.main = 'test'
				}
			}

			// bin
			if (answers.binEntry) {
				await write(
					'bin.cjs',
					[
						'#!/usr/bin/env node',
						"'use strict'",
						'',
						`/** @type {typeof import("./${sourceEdition.binPath}") } */`,
						`module.exports = require('editions').requirePackage(__dirname, require, '${nodeEdition.bin}')`,
						'',
					].join('\n')
				)
				packageData.bin = binEntry(answers, 'bin.cjs')
				if (nodeEditionImport) {
					await write(
						'bin.mjs',
						`export * from './${nodeEditionImport.testPath}')`
					)
					packageData.bin = binEntry(answers, 'bin')
				}
			}
		}
		// edition autoloader not used
		else {
			// bin
			if (answers.binEntry) {
				if (nodeEdition !== sourceEdition) {
					// change this based on package type
					const entry = 'bin.' + answers.packageModule ? 'mjs' : 'cjs'
					await write(
						entry,
						[
							'#!/usr/bin/env node',
							"'use strict'",
							'',
							...(answers.packageModule
								? [`export * from './${nodeEdition.binPath}'`]
								: [
										`/** @type {typeof import("./${sourceEdition.binPath}") } */`,
										`module.exports = require('./${nodeEdition.binPath}')`,
								  ]),
							'',
						].join('\n')
					)
					packageData.bin = binEntry(answers, entry)
				} else if (nodeEdition) {
					// check for websites
					packageData.bin = binEntry(answers, nodeEdition.binPath)
				}
			}

			// node
			if (nodeEdition) {
				// check for websites
				packageData.main = nodeEdition.entryPath
				state.test = nodeEdition.testPath
			} else {
				delete packageData.main
				delete state.test
			}
		}

		// type
		packageData.type = answers.packageModule ? 'module' : 'commonjs'

		// browser path
		updateEditionEntries(state)

		// log
		status('...scaffolded edition files')
	}
	// no editions
	else {
		// go directly to source
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
			? [packageData.bin]
			: Object.values(packageData.bin)
		).map((i) => `./${i}`)
		await spawn(['chmod', '+x', ...bins])
		status('...ensured correct bin permission')
	}
}
