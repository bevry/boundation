/* eslint no-console:0 */
'use strict'

// External
const pathUtil = require('path')

// Local
const { status } = require('./log')
const { add, has, strip } = require('./util.js')

// Helpers
class Edition {
	constructor(opts) {
		Object.defineProperty(this, 'targets', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'dependencies', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'devDependencies', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'compiler', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'scripts', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'compiler', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'babel', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'active', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'main', {
			enumerable: false,
			get() {
				return this.entry
			},
			set(value) {
				this.entry = value
			}
		})

		Object.defineProperty(this, 'test', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'bin', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'mainPath', {
			enumerable: false,
			get() {
				return pathUtil.join(this.directory || '.', this.main)
			}
		})

		Object.defineProperty(this, 'testPath', {
			enumerable: false,
			get() {
				return pathUtil.join(this.directory || '.', this.test)
			}
		})

		Object.defineProperty(this, 'binPath', {
			enumerable: false,
			get() {
				return pathUtil.join(this.directory || '.', this.bin)
			}
		})

		opts.tags = new Set(opts.tags || [])
		opts.dependencies = new Set(opts.dependencies || [])
		opts.devDependencies = new Set(opts.devDependencies || [])

		Object.assign(this, { scripts: {}, active: true }, opts)
	}
}

// Actions
async function generateEditions(state) {
	const { answers, packageData } = state

	// log
	status('updating editions...')

	// handle
	if (answers.website) {
		delete packageData.main
		state.editions = [
			{
				description: 'source',
				directory: '.',
				tags: [
					...answers.languages,
					answers.sourceModule ? 'import' : 'require'
				]
			}
		]
	} else {
		const editions = new Map()

		// Generate base editions based on language
		if (answers.language === 'es5') {
			const edition = new Edition({
				directory: answers.sourceDirectory,
				main: `${answers.mainEntry}.js`,
				test: `${answers.testEntry}.js`,
				bin: `${answers.binEntry}.js`,
				tags: [
					'javascript',
					'es5',
					answers.sourceModule ? 'import' : 'require'
				],
				engines: {
					node: true,
					browsers: answers.browsers
				}
			})

			if (answers.flowtype) {
				add(edition.tags, 'flow type comments')
			}

			editions.set('source', edition)
		} else if (answers.language === 'esnext') {
			const edition = new Edition({
				directory: answers.sourceDirectory,
				main: `${answers.mainEntry}.js`,
				test: `${answers.testEntry}.js`,
				bin: `${answers.binEntry}.js`,
				tags: [
					'javascript',
					'esnext',
					answers.sourceModule ? 'import' : 'require'
				],
				engines: {
					node: true,
					browsers:
						answers.browsers && answers.targets.includes('browser') === false
				}
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
					main: `${answers.mainEntry}.ts`,
					test: `${answers.testEntry}.ts`,
					bin: `${answers.binEntry}.js`,
					tags: ['typescript', 'import'],
					engines: false
				})
			)
		} else if (answers.language === 'coffeescript') {
			editions.set(
				'source',
				new Edition({
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.coffee`,
					test: `${answers.testEntry}.coffee`,
					bin: `${answers.binEntry}.coffee`,
					tags: ['coffeescript', 'require'],
					engines: false
				})
			)
			editions.set(
				'esnext',
				new Edition({
					compiler: 'coffeescript',
					directory: 'edition-esnext',
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					bin: `${answers.binEntry}.js`,
					tags: ['javascript', 'esnext', 'require'],
					engines: {
						node: true,
						browsers:
							answers.browsers && answers.targets.includes('browser') === false
					}
				})
			)
		} else if (answers.language === 'json') {
			editions.set(
				'source',
				new Edition({
					description: 'JSON',
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.json`,
					test: `${answers.testEntry}.js`,
					bin: `${answers.binEntry}.js`,
					tags: ['json'],
					engines: {
						node: true,
						browsers:
							answers.browsers && answers.targets.includes('browser') === false
					}
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
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						bin: `${answers.binEntry}.js`,
						tags: ['javascript', answers.sourceModule ? 'import' : 'require'],
						targets: {
							es: 'ESNext',
							browsers: answers.browsers
						},
						engines: {
							node: false,
							browsers: answers.browsers
						}
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
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						bin: `${answers.binEntry}.js`,
						tags: ['javascript', answers.packageModule ? 'import' : 'require'],
						targets: {
							node: version
						},
						engines: {
							node: true,
							browsers: false
						}
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
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						bin: `${answers.binEntry}.js`,
						tags: [
							'javascript',
							syntax,
							answers.packageModule ? 'import' : 'require'
						],
						targets: {
							es: target
						},
						engines: {
							node: true,
							browsers:
								answers.browsers &&
								answers.targets.includes('browser') === false
						}
					})
				)
			} else {
				throw new Error(`invalid target: ${target}`)
			}
		}

		// autogenerate various fields
		editions.forEach(function(edition) {
			const browserVersion =
				(edition.targets && edition.targets.browsers) ||
				(edition.engines && edition.engines.browsers)
			const nodeVersion =
				(edition.targets && edition.targets.node) ||
				(edition.engines && edition.engines.node)

			// add compilation details
			if (edition.compiler === 'coffeescript') {
				edition.scripts[
					`our:compile:${edition.directory}`
				] = `coffee -bco ./${edition.directory} ./${answers.sourceDirectory}`
			} else if (edition.compiler === 'typescript') {
				edition.scripts[`our:compile:${edition.directory}`] = [
					'tsc',
					has(edition.tags, 'require')
						? '--module commonjs'
						: '--module ESNext',
					`--target ${edition.targets.es}`,
					`--outDir ./${edition.directory}`,
					`--project ${answers.tsconfig}`,
					// fix typescript embedding the source directory inside the output
					`&& test -d ${edition.directory}/${answers.sourceDirectory}`,
					`&& (`,
					`mv ${edition.directory}/${answers.sourceDirectory} edition-temp`,
					`&& rm -Rf ${edition.directory}`,
					`&& mv edition-temp ${edition.directory}`,
					`) || true`
				]
					.filter(part => part)
					.join(' ')
			} else if (edition.compiler === 'babel') {
				if (answers.language === 'coffeescript') {
					// add coffee compile script
					edition.scripts[`our:compile:${edition.directory}`] = [
						`env BABEL_ENV=${edition.directory}`,
						'coffee -bcto',
						`./${edition.directory}/`,
						`./${answers.sourceDirectory}`
					]
						.filter(part => part)
						.join(' ')
				} else {
					// add babel compile script
					edition.scripts[`our:compile:${edition.directory}`] = [
						`env BABEL_ENV=${edition.directory}`,
						'babel',
						answers.language === 'typescript' ? '--extensions ".ts,.tsx"' : '',
						`--out-dir ./${edition.directory}`,
						`./${answers.sourceDirectory}`
					]
						.filter(part => part)
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
									answers.sourceModule === answers.packageModule
										? false
										: answers.packageModule
										? 'auto'
										: 'commonjs'
							}
						]
					],
					plugins: ['@babel/proposal-object-rest-spread']
				}

				add(
					edition.devDependencies,
					'@babel/core',
					'@babel/cli',
					'@babel/preset-env',
					'@babel/plugin-proposal-object-rest-spread'
				)

				// disabled as typescript compiler doesn't support this compat
				// so having it only on babel screws with consistency
				// plus it causes inconsistency between browser and node editions
				// if (answers.sourceModule && !answers.packageModule) {
				// 	add(edition.devDependencies, 'babel-plugin-add-module-exports')
				// 	add(edition.babel.plugins, 'add-module-exports')
				// }

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

			// ensure description exists
			if (!edition.description) {
				const description = [
					answers.language,
					edition.directory === answers.sourceDirectory
						? 'source code'
						: 'compiled'
				]
				if (edition.targets && edition.targets.es) {
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
						description.push(`${nodeVersion}`)
					}
				}
				if (has(edition.tags, 'require')) {
					description.push('with require for modules')
				} else if (has(edition.tags, 'import')) {
					description.push('with import for modules')
				}
				edition.description = description.join(' ')
			}

			// fix tags
			edition.tags = Array.from(edition.tags.values())
		})

		// prepare
		state.editions = Array.from(editions.values())
	}

	// log
	console.log(
		'editions:',
		state.editions.map(edition => edition.directory).join(', ')
	)
	status('...updated editions')
}

module.exports = { generateEditions }
