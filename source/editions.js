/* eslint no-console:0 */
'use strict'

// External
const pathUtil = require('path')

// Local
const { status } = require('./log')

// Helpers
class Edition {
	constructor(opts) {
		Object.defineProperty(this, 'targets', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'scripts', {
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

		Object.assign(this, { active: true }, opts)
	}
}

// Actions
async function generateEditions(state) {
	const { answers, packageData } = state
	let babel = false

	// log
	status('updating editions...')

	// handle
	if (answers.website) {
		delete packageData.main
		state.editions = [
			{
				description: 'source',
				directory: '.',
				tags: [...answers.languages, answers.modules ? 'import' : 'require']
			}
		]
	} else {
		const editions = []

		// Generate base editions based on language
		if (answers.language === 'esnext') {
			babel = true
			editions.push(
				new Edition({
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					bin: `${answers.binEntry}.js`,
					tags: ['javascript', 'esnext'],
					engines: {
						node: true,
						browsers: false
					}
				})
			)
			if (answers.modules) {
				editions[0].tags.push('import')
			} else {
				editions[0].tags.push('require')
			}
			if (answers.flowtype) {
				editions[0].tags.push('flow type comments')
			}
		} else if (answers.language === 'typescript') {
			babel = true
			editions.push(
				new Edition({
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.ts`,
					test: `${answers.testEntry}.ts`,
					bin: `${answers.binEntry}.js`,
					tags: ['typescript', 'import'],
					engines: false
				})

				/*
				...['ES3', 'ES5', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ESNEXT'].reverse().map(function (target) {
					const syntax = target.toLocaleLowerCase()
					const directory = `edition-${syntax}`
					return new Edition({
						directory,
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						tags: [
							'javascript',
							syntax,
							'require'
						],
						engines: {
							node: true,
							browsers: false
						},
						scripts: {
							[`our:compile:${directory}`]: `tsc --module commonjs --target ${target} --outDir ./${directory}`
						}
					})
				})
				*/
			)
		} else if (answers.language === 'coffeescript') {
			babel = true
			editions.push(
				new Edition({
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.coffee`,
					test: `${answers.testEntry}.coffee`,
					bin: `${answers.binEntry}.coffee`,
					tags: ['coffeescript', 'require'],
					engines: false
				}),
				new Edition({
					directory: 'edition-esnext',
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					bin: `${answers.binEntry}.js`,
					tags: ['javascript', 'esnext', 'require'],
					engines: {
						node: true,
						browsers: false
					},
					scripts: {
						'our:compile:edition-esnext': `coffee -bco ./edition-esnext ./${
							answers.sourceDirectory
						}`
					}
				})
			)
		} else if (answers.language === 'json') {
			editions.push(
				new Edition({
					description: 'JSON',
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.json`,
					test: `${answers.testEntry}.js`,
					bin: `${answers.binEntry}.js`,
					tags: ['json'],
					engines: {
						node: true,
						browsers: true
					}
				})
			)
		} else {
			throw new Error('language should have been defined, but it was missing')
		}

		// Add the browser edition if necessary
		if (answers.browsers) {
			babel = true
			editions.push(
				new Edition({
					directory: 'edition-browsers',
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					bin: `${answers.binEntry}.js`,
					tags: ['javascript', answers.modules ? 'import' : 'require'],
					targets: answers.browsers,
					engines: {
						node: false,
						browsers: answers.browsers
					}
				})
			)
		}

		// Add the compiled editions if necessary
		if (answers.adaptive && babel) {
			// max should be first, as it is our most desired compilation target for editions
			// e.g. node 11 (max), node 10 (desired), node 0.12 (min)
			const versions = new Set([
				answers.maximumSupportNodeVersion,
				answers.desiredNodeVersion,
				answers.minimumSupportNodeVersion
			])
			for (const version of versions) {
				editions.push(
					new Edition({
						directory: `edition-node-${version}`,
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						bin: `${answers.binEntry}.js`,
						tags: ['javascript', 'require'],
						targets: {
							node: version
						},
						engines: {
							node: true,
							browsers: false
						}
					})
				)
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
			if (
				edition.directory !== answers.sourceDirectory &&
				edition.targets &&
				!edition.scripts
			) {
				if (answers.language === 'coffeescript') {
					// add coffee compile script
					edition.babel = true
					edition.scripts = {
						[`our:compile:${edition.directory}`]: `env BABEL_ENV=${
							edition.directory
						} coffee -bcto ./${edition.directory}/ ./${answers.sourceDirectory}`
					}
				} else {
					// add custom babel env
					edition.babel = true

					// add babel compile script
					const parts = [
						`env BABEL_ENV=${edition.directory}`,
						'babel',
						answers.language === 'typescript' ? '--extensions ".ts,.tsx"' : '',
						`--out-dir ./${edition.directory}`,
						`./${answers.sourceDirectory}`
					].filter(part => part)
					edition.scripts = {
						[`our:compile:${edition.directory}`]: parts.join(' ')
					}
				}
			}

			// populate babel
			if (edition.babel === true) {
				edition.babel = {
					sourceType: answers.modules ? 'module' : 'script',
					presets: [
						[
							'@babel/preset-env',
							{
								targets: edition.targets,
								modules: edition.tags.includes('import') ? false : 'commonjs'
							}
						]
					],
					plugins: ['@babel/proposal-object-rest-spread']
				}
				if (answers.language === 'typescript') {
					edition.babel.presets.push('@babel/preset-typescript')
					edition.babel.plugins.push(
						'@babel/proposal-class-properties',
						'add-module-exports'
					)
				}
			}

			// ensure description exists
			if (!edition.description) {
				if (edition.directory === answers.sourceDirectory) {
					edition.description = `${answers.language} source code`
				} else if (browserVersion) {
					edition.description = `${answers.language} compiled for browsers`
					if (
						typeof browserVersion === 'string' &&
						browserVersion !== 'defaults'
					) {
						edition.description += ` [${browserVersion}]`
					}
				} else if (nodeVersion) {
					edition.description = `${answers.language} compiled for node.js`
					if (typeof nodeVersion === 'string') {
						edition.description += ` ${nodeVersion}`
					}
				} else {
					edition.description = `${answers.language} compiled` // for node.js >=${answers.minimumSupportNodeVersion}`
				}
				if (edition.tags.includes('require')) {
					edition.description += ' with require for modules'
				} else if (edition.tags.includes('import')) {
					edition.description += ' with import for modules'
				}
			}
		})

		// prepare
		state.editions = editions
	}

	// log
	console.log(
		'editions:',
		state.editions.map(edition => edition.directory).join(', ')
	)
	status('...updated editions')
}

module.exports = { generateEditions }
