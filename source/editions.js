// builtin
import * as pathUtil from 'node:path'

// external
import { add, has, intersect } from '@bevry/list'
import { isAccessible } from '@bevry/fs-accessible'
import write from '@bevry/fs-write'
import { fetchAllCompatibleESVersionsForNodeVersions } from '@bevry/nodejs-ecmascript-compatibility'
import { filterNodeVersions } from '@bevry/nodejs-versions'

// local
import { status } from './log.js'
import {
	strip,
	addExtension,
	fixTsc,
	useStrict,
	exportOrExports,
	importOrRequire,
	binField,
	cojoin,
	set,
	unjoin,
} from './util.js'
import {
	allTypescriptTargets,
	languageNames,
	defaultBrowserTarget,
	defaultCoffeeTarget,
} from './data.js'
import { spawn, exec, unlinkIfContains } from './fs.js'

async function writeLoader({
	entry = 'index',
	autoloader = false,
	exportDefault = false,
	typesPath = '',
	targetEntry = '',
	targetPath = '',
}) {
	const bin = entry.startsWith('bin')
	const mjs = entry.endsWith('.mjs')
	const cjs = !mjs
	const lines = [
		bin && '#!/usr/bin/env node',
		cjs && "'use strict'",
		'// auto-generated by boundation, do not update manually',
	]
	if (autoloader) {
		if (mjs) {
			// https://github.com/bevry/editions/issues/83
			throw new Error('autoloader does not yet support mjs')
		}
		lines.push(`/** @type {typeof import("${cojoin('.', typesPath)}") } */`)
		if (targetEntry) {
			lines.push(
				`module.exports = require('editions').requirePackage(__dirname, require, '${targetEntry}')`,
			)
		} else {
			lines.push(
				`module.exports = require('editions').requirePackage(__dirname, require)`,
			)
		}
	} else {
		if (mjs) lines.push(`export * from './${targetPath}'`)
		if (exportDefault)
			lines.push(
				`import d from './${targetPath}'`,
				// cjs exports {default} instead of default
				'export default ' + (cjs ? 'd.default || d' : 'd'),
			)
		if (cjs) lines.push(`module.exports = require('./${targetPath}')`)
	}
	await write(entry, lines.filter((i) => i).join('\n'))
}

async function writeEntry({
	entry = 'index',
	autoloader = false,
	always = false,
	exportDefault = false,
	sourceEdition,
	typesEdition,
	nodeEditionRequire,
	nodeEditionImport,
}) {
	let resolved

	if (nodeEditionRequire) {
		if (autoloader || always) {
			const entryWithExtension = entry + '.cjs'
			await writeLoader({
				entry: entryWithExtension,
				autoloader,
				typesPath: typesEdition && typesEdition[entry + 'Path'],
				targetEntry: nodeEditionRequire[entry],
				targetPath: nodeEditionRequire[entry + 'Path'],
			})
			resolved = entryWithExtension
		} else {
			resolved = nodeEditionRequire[entry + 'Path']
		}
	} else if (nodeEditionImport) {
		if (autoloader) {
			throw new Error('autoloader does not yet support only mjs')
		} else if (always) {
			const entryWithExtension = entry + '.mjs'
			await writeLoader({
				entry: entryWithExtension,
				autoloader,
				typesPath: typesEdition && typesEdition[entry + 'Path'],
				targetEntry: nodeEditionImport[entry],
				targetPath: nodeEditionImport[entry + 'Path'],
			})
			resolved = entryWithExtension
		} else {
			// package.json:exports.import dismisses the need for a .mjs loader file
			resolved = nodeEditionImport[entry + 'Path']
		}
	}
	// always resolve, as node doesn't support extensionless entries inside package.json
	return resolved
}

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

		// entry path is an indexPath that actually has engines
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

		Object.defineProperty(this, 'compileCommand', {
			enumerable: false,
			writable: true,
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

	// source edition
	if (answers.website) {
		delete packageData.main
		state.editions = [
			new Edition({
				description: 'source',
				directory: '.',
				tags: [
					'source',
					'website',
					...answers.languages,
					answers.sourceModule ? 'import' : 'require',
				],
			}),
		]
	} else {
		const editions = new Map()

		// Generate source edition based on language
		if (answers.language === 'es5') {
			const edition = new Edition({
				directory: answers.sourceDirectory,
				index: addExtension(answers.indexEntry, `js`),
				node: addExtension(answers.nodeEntry, `js`),
				browser: addExtension(answers.browserEntry, `js`),
				test: addExtension(answers.testEntry, `js`),
				bin: addExtension(answers.binEntry, `js`),
				tags: [
					'source',
					'javascript',
					'es5',
					answers.sourceModule ? 'import' : 'require',
				],
				engines: {
					node: true,
					browsers: answers.browsersTargeted,
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
					'source',
					'javascript',
					'esnext',
					answers.sourceModule ? 'import' : 'require',
				],
				engines: {
					node: true,
					browsers: answers.browsersTargeted && !answers.compilerBrowser,
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
					tags: ['source', 'typescript', 'import'],
					engines: false,
				}),
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
					tags: ['source', 'coffeescript', 'require'],
					engines: false,
				}),
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
					tags: ['source', 'json'],
					engines: {
						node: true,
						browsers: answers.browsersTargeted && !answers.compilerBrowser,
					},
				}),
			)
		} else {
			throw new Error('language should have been defined, but it was missing')
		}

		// add browser edition
		if (answers.compilerBrowser) {
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
					tags: [
						'compiled',
						'javascript',
						answers.sourceModule ? 'import' : 'require',
					],
					targets: {
						es: defaultBrowserTarget,
						esmodules: answers.sourceModule,
						browsers: answers.browsersTargeted,
					},
					engines: {
						node: false,
						browsers: answers.browsersTargeted,
					},
				}),
			)
		}

		// add coffeescript edition
		if (answers.compilerNode === 'coffeescript') {
			const syntax = defaultCoffeeTarget.toLowerCase()
			const directory = `edition-${syntax}`
			editions.set(
				'coffeescript',
				new Edition({
					compiler: 'coffeescript',
					directory,
					index: addExtension(answers.indexEntry, `js`),
					node: addExtension(answers.nodeEntry, `js`),
					browser: addExtension(answers.browserEntry, `js`),
					test: addExtension(answers.testEntry, `js`),
					bin: addExtension(answers.binEntry, `js`),
					tags: ['compiled', 'javascript', syntax, 'require'],
					engines: {
						node: true,
						browsers: answers.browsersTargeted,
					},
				}),
			)
		}

		// add edition for each babel/typescript target
		if (
			answers.compilerNode === 'babel' ||
			answers.compilerNode === 'typescript'
		) {
			for (const targetModule of answers.targetModules) {
				/* eslint no-undefined:0 */
				const nodeVersionsTargets = filterNodeVersions(
					answers.nodeVersionsTargeted,
					{
						esm: targetModule === 'import',
						range:
							targetModule === 'import'
								? answers.nodeVersionsTargetedImportRange
								: targetModule === 'require'
								  ? answers.nodeVersionsTargetedRequireRange
								  : undefined,
					},
				)
					.slice()
					.reverse() // reverse modifies the actual array, hence need for slice
				if (answers.compilerNode === 'babel') {
					for (const nodeVersionTarget of nodeVersionsTargets) {
						const directory =
							`edition-node-${nodeVersionTarget}` +
							(targetModule === 'import' ? '-esm' : '')
						editions.set(
							directory,
							new Edition({
								compiler: 'babel',
								directory,
								index: addExtension(answers.indexEntry, `js`),
								node: addExtension(answers.nodeEntry, `js`),
								browser: addExtension(answers.browserEntry, `js`),
								test: addExtension(answers.testEntry, `js`),
								bin: addExtension(answers.binEntry, `js`),
								tags: ['compiled', 'javascript', targetModule],
								targets: {
									node: nodeVersionTarget,
								},
								engines: {
									node: true,
									browsers: false,
								},
							}),
						)
					}
				} else if (answers.compilerNode === 'typescript') {
					const esVersionsTargets = new Set()
					for (const nodeVersionTarget of nodeVersionsTargets) {
						// fetch the latest es version for the node.js version target that typescript supports
						const esVersionTarget = intersect(
							allTypescriptTargets,
							await fetchAllCompatibleESVersionsForNodeVersions([
								nodeVersionTarget,
							]),
						)[0]
						// check that typescript supported it
						if (!esVersionTarget) continue
						// check that we haven't already generated an edition for this es verison target target
						if (esVersionsTargets.has(esVersionTarget)) continue
						esVersionsTargets.add(esVersionTarget)
						// generate the edition
						const esVersionTargetLower = esVersionTarget.toLowerCase()
						const directory =
							`edition-${esVersionTargetLower}` +
							(targetModule === 'import' ? '-esm' : '')
						editions.set(
							directory,
							new Edition({
								compiler: 'typescript',
								directory,
								index: addExtension(answers.indexEntry, `js`),
								node: addExtension(answers.nodeEntry, `js`),
								browser: addExtension(answers.browserEntry, `js`),
								test: addExtension(answers.testEntry, `js`),
								bin: addExtension(answers.binEntry, `js`),
								tags: [
									'compiled',
									'javascript',
									esVersionTargetLower,
									targetModule,
								],
								targets: {
									node: nodeVersionTarget,
									es: esVersionTarget,
								},
								engines: {
									node: true,
									browsers: false,
								},
							}),
						)
					}
				} else {
					throw new Error(`invalid target for the compiler`)
				}
			}
		}

		// add types
		if (answers.language === 'typescript') {
			editions.set(
				'types',
				new Edition({
					compiler: 'types',
					directory: 'edition-types',
					index: addExtension(answers.indexEntry, `d.ts`),
					node: addExtension(answers.nodeEntry, `d.ts`),
					browser: addExtension(answers.browserEntry, `d.ts`),
					test: addExtension(answers.testEntry, `d.ts`),
					bin: addExtension(answers.binEntry, `d.ts`),
					tags: ['compiled', 'types', 'import'],
					engines: false,
				}),
			)
		} else {
			// define the possible locations
			// do note that they must exist throughout boundation, which if it is a compiled dir, is sporadic
			const sourceEdition = editions.get('source')
			const typePaths = [
				// e.g. index.d.ts
				pathUtil.join(answers.indexEntry + '.d.ts'),
				// e.g. source/index.d.ts
				sourceEdition &&
					pathUtil.join(sourceEdition.directory, answers.indexEntry + '.d.ts'),
			].filter((i) => i)
			// fetch their existing status and convert back into the original location
			const typePathsExisting = await Promise.all(
				typePaths.map((i) => isAccessible(i).then((e) => e && i)),
			)
			// find the first location that exists
			const typePath = typePathsExisting.find((i) => i)
			// and if exists, add our types edition
			if (typePath) {
				editions.set(
					'types',
					new Edition({
						directory: '.',
						index: typePath,
						tags: ['types', answers.sourceModule ? 'import' : 'require'],
						engines: false,
					}),
				)
			}
		}

		// update state
		state.editions = Array.from(editions.values())
	}

	// log
	console.log(
		'editions:',
		state.editions.map((edition) => edition.directory).join(', '),
	)
	status('...updated editions')
}

export function updateEditionFields(state) {
	const { answers, editions } = state

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
			edition.scripts[compileScriptName] =
				`coffee -bco ./${edition.directory} ./${answers.sourceDirectory}`
		} else if (edition.compiler === 'types') {
			edition.scripts[compileScriptName] = [
				'tsc',
				'--emitDeclarationOnly',
				'--declaration',
				'--declarationMap',
				`--declarationDir ./${edition.directory}`,
				`--project ${answers.tsconfig}`,
				...fixTsc(edition.directory, answers.sourceDirectory),
			]
				.filter((part) => part)
				.join(' ')
		} else if (edition.compiler === 'typescript') {
			edition.scripts[compileScriptName] = [
				'tsc',
				has(edition.tags, 'require') ? '--module commonjs' : '--module ESNext',
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
							modules: has(edition.tags, 'import')
								? answers.sourceModule
									? false
									: 'auto'
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
				'@babel/plugin-proposal-object-rest-spread',
			)

			if (answers.language === 'typescript') {
				add(edition.babel.presets, '@babel/preset-typescript')
				add(
					edition.babel.plugins,
					'@babel/plugin-proposal-optional-chaining',
					'@babel/proposal-class-properties',
				)
				add(
					edition.devDependencies,
					'@babel/core',
					'@babel/preset-typescript',
					'@babel/plugin-proposal-class-properties',
					'@babel/plugin-proposal-object-rest-spread',
					'@babel/plugin-proposal-optional-chaining',
				)
			}
		}

		// add the package.json type information to the edition
		if (edition.engines.node && edition.scripts[compileScriptName]) {
			const packageType = has(edition.tags, 'require') ? 'commonjs' : 'module'
			edition.scripts[compileScriptName] +=
				` && printf '%s' '{"type": "${packageType}"}' > ${edition.directory}/package.json`
		}

		// ensure description exists
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
			if (typeof browserVersion === 'string' && browserVersion !== 'defaults') {
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
		if (has(edition.tags, 'types')) {
			description.push('Types')
		}
		if (has(edition.tags, 'require')) {
			description.push('with Require for modules')
		} else if (has(edition.tags, 'import')) {
			description.push('with Import for modules')
		}
		edition.description = description.join(' ')
		edition.compileCommand = [answers.packageManager, 'run', compileScriptName]
	})
}

// Helpers
export function updateEditionEntries(state) {
	const {
		typesEdition,
		nodeEditionRequire,
		nodeEditionImport,
		browserEdition,
		packageData,
	} = state

	// reset
	delete packageData.node
	delete packageData.mjs
	delete packageData.cjs

	// https://nodejs.org/api/esm.html#esm_conditional_exports
	// https://devblogs.microsoft.com/typescript/announcing-typescript-4-7/#package-json-exports-imports-and-self-referencing
	// https://nodejs.org/api/packages.html#packages_exports
	// https://nodejs.org/api/packages.html#package-entry-points
	// https://nodejs.org/api/packages.html#subpath-exports
	// https://nodejs.org/api/packages.html#conditional-exports
	packageData.exports = {}

	// types
	// https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html
	const typesIndexPath = cojoin('.', typesEdition && typesEdition.indexPath)
	if (typesIndexPath) {
		packageData.types = typesEdition.indexPath // don't prefix the ./
	}

	// node exports
	const autoloaderPath = cojoin(
		'.',
		state.useEditionsAutoloader && packageData.main,
	)
	const nodeImportPath = cojoin(
		'.',
		nodeEditionImport && nodeEditionImport.indexPath,
	)
	const nodeRequirePath = cojoin(
		'.',
		nodeEditionRequire && nodeEditionRequire.indexPath,
	)
	if (nodeImportPath || autoloaderPath || nodeRequirePath) {
		const nodeExports = {}
		set(nodeExports, 'types', typesIndexPath || null)
		set(nodeExports, 'import', nodeImportPath || null)
		set(nodeExports, 'default', autoloaderPath || null) // default before require, as require should be direct, whereas the autoloader is indirect, as intended
		set(nodeExports, 'require', nodeRequirePath || null)
		set(packageData.exports, 'node', nodeExports)
	}

	// browser exports
	const browserPath = cojoin('.', browserEdition && browserEdition.indexPath)
	const browserImportPath =
		has(browserEdition && browserEdition.tags, 'import') && browserPath
	const browserRequirePath =
		has(browserEdition && browserEdition.tags, 'require') && browserPath
	if (browserImportPath || browserRequirePath) {
		const browserExports = {}
		set(browserExports, 'types', typesIndexPath || null)
		set(browserExports, 'import', browserImportPath || null)
		set(browserExports, 'require', browserRequirePath || null)
		set(packageData.exports, 'browser', browserExports)
	}
	set(packageData, 'browser', unjoin('.', browserPath) || null)
	set(packageData, 'module', unjoin('.', browserImportPath) || null)

	// // default exports
	// const activePath = cojoin('.', activeEdition && activeEdition.indexPath)
	// const activeImportPath =
	// 	has(activeEdition && activeEdition.tags, 'import') && activePath
	// const activeRequirePath =
	// 	has(activeEdition && activeEdition.tags, 'require') && activePath
	// if (activeImportPath || activeRequirePath) {
	// 	const defaultExports = {}
	// 	set(defaultExports, 'types', typesIndexPath || null)
	// 	set(defaultExports, 'import', activeImportPath || null)
	// 	set(defaultExports, 'require', activeRequirePath || null)
	// 	set(packageData.exports, 'default', defaultExports)
	// }
	// ^ this never worked due to activeEdition not resolving due to missing getter, currently activeEdition is resolving to typescript source edition, which isn't what we want, so just ignore it for now.

	// delete the exports if we don't need it
	// this is required for for eslint-config-bevry/adapt.js
	// as if node.js handles exports, it only allows exported paths and that is it
	if (!nodeImportPath) delete packageData.exports
}

export async function scaffoldEditions(state) {
	// fetch
	const {
		typesEdition,
		sourceEdition,
		nodeEdition,
		nodeEditionRequire,
		nodeEditionImport,
		activeEditions,
		packageData,
		answers,
	} = state

	// clean old edition files
	await unlinkIfContains(
		[
			'bin.js',
			'bin.cjs',
			'bin.mjs',
			'index.js',
			'index.cjs',
			'index.mjs',
			'test.js',
			'test.cjs',
			'test.mjs',
		],
		"'editions'",
	)

	// export default
	let exportDefault = false
	answers.keywords.delete('export-default')
	if (answers.sourceModule) {
		try {
			await exec(`cat ${sourceEdition.indexPath} | grep 'export default'`)
			exportDefault = true
			answers.keywords.add('export-default')
		} catch (err) {}
	}

	// handle
	if (activeEditions.length) {
		// log
		status('scaffolding edition files...')

		// scaffold edition directories
		await spawn(
			['mkdir', '-p'].concat(
				activeEditions.map((edition) => edition.directory || '.'),
			),
		)

		// move or scaffold edition main path if needed
		if (sourceEdition.indexPath) {
			if ((await isAccessible(sourceEdition.indexPath)) === false) {
				// edition index entry doesn't exist, but it is a docpad plugin
				if (answers.docpadPlugin) {
					await write(
						sourceEdition.indexPath,
						[
							useStrict(answers.sourceModule),
							exportOrExports(
								"class MyPlugin extends require('docpad-baseplugin') {",
								answers.sourceModule,
							),
							"\tget name () { return 'myplugin' }",
							'\tget initialConfig () { return {} }',
							'}',
							'',
						].join('\n'),
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
						].join('\n'),
					)
			}
		}

		// move or scaffold edition test path if needed
		if (sourceEdition.testPath) {
			if (answers.docpadPlugin === false) {
				if ((await isAccessible(sourceEdition.testPath)) === false) {
					// edition test entry doesn't exist, so create a basic test file
					if (answers.kava) {
						await write(
							sourceEdition.testPath,
							[
								useStrict(answers.sourceModule),
								importOrRequire(
									'{equal}',
									'assert-helpers',
									answers.sourceModule,
								),
								importOrRequire('kava', 'kava', answers.sourceModule),
								'',
								`kava.suite('${packageData.name}', function (suite, test) {`,
								"\ttest('no tests yet', function () {",
								"\t\tconsole.log('no tests yet')",
								'\t})',
								'})',
								'',
							].join('\n'),
						)
					} else {
						await write(
							sourceEdition.testPath,
							[
								useStrict(answers.sourceModule),
								exportOrExports("'@todo'", answers.sourceModule),
								'',
							].join('\n'),
						)
					}
				}
			}
		}

		// setup paths
		if (nodeEdition) {
			packageData.main = await writeEntry({
				entry: 'index',
				autoloader: state.useEditionsAutoloader,
				exportDefault,
				typesEdition,
				sourceEdition,
				nodeEditionRequire,
				nodeEditionImport,
			})

			// bin
			if (answers.binEntry) {
				packageData.bin = binField(
					answers,
					await writeEntry({
						entry: 'bin',
						always: true,
						autoloader: state.useEditionsAutoloader,
						exportDefault,
						typesEdition,
						sourceEdition,
						nodeEditionRequire,
						nodeEditionImport,
					}),
				)
			}

			// don't bother test with docpad plugins
			// as they hae their own testing solution
			if (answers.docpadPlugin === false) {
				state.test = await writeEntry({
					entry: 'test',
					autoloader: state.useEditionsAutoloader,
					exportDefault,
					typesEdition,
					sourceEdition,
					nodeEditionRequire,
					nodeEditionImport,
				})
			}
		}
		// no node edition, so no testing
		else {
			delete packageData.main
			delete packageData.bin
			delete packageData.test
			delete state.test
		}

		// make the type what the source edition is
		// as the compiled editions get their own package.json file
		// this does however require that example files get their appropriate extension
		packageData.type = has(sourceEdition.tags, 'import') ? 'module' : 'commonjs'

		// browser path
		updateEditionEntries(state)

		// log
		status('...scaffolded edition files')
	}
	// no editions
	else {
		// delete type, as no way of determining what it should be
		delete packageData.type

		// go directly to source
		if (answers.indexEntry) {
			packageData.main = answers.indexEntry + '.js'
		}
		updateEditionEntries(state)
		if (answers.testEntry) {
			state.test = answers.testEntry + '.js'
		}
		packageData.bin = binField(answers, answers.binEntry + '.js')
	}
}
