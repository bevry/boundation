/* eslint no-console:0 */
'use strict'

// External
const pathUtil = require('path')

// Local
const { status } = require('./log')

// Helpers
class Edition {
	constructor (opts) {
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
			get () {
				return this.entry
			},
			set (value) {
				this.entry = value
			}
		})

		Object.defineProperty(this, 'test', {
			enumerable: false,
			writable: true
		})

		Object.defineProperty(this, 'mainPath', {
			enumerable: false,
			get () {
				return pathUtil.join(this.directory || '.', this.main)
			}
		})

		Object.defineProperty(this, 'testPath', {
			enumerable: false,
			get () {
				return pathUtil.join(this.directory || '.', this.test)
			}
		})

		Object.assign(this, { active: true }, opts)
	}
}

// Actions
async function generateEditions (state) {
	const { answers, packageData } = state

	// log
	status('updating editions...')

	// handle
	if (answers.website) {
		status('skipped editions')
		delete packageData.main
	}
	else {
		status('updating editions...')
		const editions = []

		// Generate base editions based on language
		if (answers.language === 'esnext') {
			editions.push(new Edition({
				directory: answers.sourceDirectory,
				main: `${answers.mainEntry}.js`,
				test: `${answers.testEntry}.js`,
				tags: [
					'javascript',
					'esnext'
				],
				engines: {
					node: true,
					browsers: false
				}
			}))
			if (answers.modules) {
				editions[0].tags.push('import')
			}
			else {
				editions[0].tags.push('require')
			}
			if (answers.flowtype) {
				editions[0].tags.push('flow type comments')
			}
		}
		else if (answers.language === 'typescript') {
			editions.push(
				new Edition({
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.ts`,
					test: `${answers.testEntry}.ts`,
					tags: [
						'typescript',
						'import'
					],
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
		}
		else if (answers.language === 'coffeescript') {
			editions.push(
				new Edition({
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.coffee`,
					test: `${answers.testEntry}.coffee`,
					tags: [
						'coffeescript',
						'require'
					],
					engines: false
				}),
				new Edition({
					directory: 'edition-esnext',
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					tags: [
						'javascript',
						'esnext',
						'require'
					],
					engines: {
						node: true,
						browsers: false
					},
					scripts: {
						'our:compile:edition-esnext': `coffee -bco ./edition-esnext ./${answers.sourceDirectory}`
					}
				})
			)
		}
		else if (answers.language === 'json') {
			editions.push(
				new Edition({
					description: 'JSON',
					directory: answers.sourceDirectory,
					main: `${answers.mainEntry}.json`,
					test: `${answers.testEntry}.js`,
					tags: [
						'json'
					],
					engines: {
						node: true,
						browsers: true
					}
				})
			)
		}
		else {
			throw new Error('language should have been defined, but it was missing')
		}

		// Add the browser edition if necessary
		if (answers.browsers) {
			editions.push(
				new Edition({
					directory: 'edition-browsers',
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					tags: [
						'javascript',
						'require'
					],
					targets: {
						browsers: answers.browsers
					},
					engines: {
						node: false,
						browsers: answers.browsers
					}
				})
			)
		}

		// Add the compiled editions if necessary
		if (answers.babel) {
			editions.push(
				new Edition({
					directory: `edition-node-${answers.maximumSupportNodeVersion}`,
					main: `${answers.mainEntry}.js`,
					test: `${answers.testEntry}.js`,
					tags: [
						'javascript',
						'require'
					],
					targets: {
						node: answers.maximumSupportNodeVersion
					},
					engines: {
						node: '>=' + answers.maximumSupportNodeVersion,
						browsers: false
					}
				})
			)
			if (answers.maximumSupportNodeVersion !== answers.desiredNodeVersion) {
				editions.push(
					new Edition({
						directory: `edition-node-${answers.desiredNodeVersion}`,
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						tags: [
							'javascript',
							'require'
						],
						targets: {
							node: answers.desiredNodeVersion
						},
						engines: {
							node: '>=' + answers.desiredNodeVersion,
							browsers: false
						}
					})
				)
			}
			if (answers.maximumSupportNodeVersion !== answers.minimumSupportNodeVersion && answers.desiredNodeVersion !== answers.minimumSupportNodeVersion) {
				editions.push(
					new Edition({
						directory: `edition-node-${answers.minimumSupportNodeVersion}`,
						main: `${answers.mainEntry}.js`,
						test: `${answers.testEntry}.js`,
						tags: [
							'javascript',
							'require'
						],
						targets: {
							node: answers.minimumSupportNodeVersion
						},
						engines: {
							node: '>=' + answers.minimumSupportNodeVersion,
							browsers: false
						}
					})
				)
			}
		}

		// autogenerate various fields
		editions.forEach(function (edition) {
			// ensure description exists
			if (!edition.description) {
				if (edition.directory === answers.sourceDirectory) {
					edition.description = `${answers.language} source code`
				}
				else if (edition.engines && edition.engines.browsers) {
					edition.description = `${answers.language} compiled for browsers`
					if (edition.engines.browsers !== 'defaults') {
						edition.description += ` [${answers.browsers}]`
					}
				}
				else if (edition.engines && edition.engines.node) {
					edition.description = `${answers.language} compiled for node.js`
					if (typeof edition.engines.node === 'string') {
						edition.description += ` ${edition.engines.node}`
					}
				}
				else {
					edition.description = `${answers.language} compiled` // for node.js >=${answers.minimumSupportNodeVersion}`
				}
				if (edition.tags.has('require')) {
					edition.description += ' with require for modules'
				}
				else if (edition.tags.has('import')) {
					edition.description += ' with import for modules'
				}
			}

			// add compilation details
			if (edition.directory !== answers.sourceDirectory && edition.targets && !edition.scripts) {
				if (answers.language === 'coffeescript') {
					// add coffee compile script
					edition.scripts = {
						[`our:compile:${edition.directory}`]: `env BABEL_ENV=${edition.directory} coffee -bcto ./${edition.directory}/ ./${answers.sourceDirectory}`
					}
				}
				else {
					// add custom babel env
					if (edition.targets && answers.language === 'typescript') {
						edition.babel = {
							presets: [
								[
									'@babel/preset-env',
									{
										targets: edition.targets
									}
								],
								'@babel/preset-typescript'
							],
							plugins: [
								'@babel/proposal-class-properties',
								'@babel/proposal-object-rest-spread'
							]
						}
					}

					// add babel compile script
					const parts = [
						`env BABEL_ENV=${edition.directory}`,
						'babel',
						answers.language === 'typescript' ? '--extensions ".ts,.tsx"' : '',
						`--out-dir ./${edition.directory}`,
						`./${answers.sourceDirectory}`
					].filter((part) => part)
					edition.scripts = {
						[`our:compile:${edition.directory}`]: parts.join(' ')
					}
				}
			}
		})

		// prepare
		state.editions = editions
	}

	// log
	console.log('editions:', state.editions.map((edition) => edition.directory).join(', '))
	status('...updated editions')
}

module.exports = { generateEditions }
