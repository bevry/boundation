/* eslint no-console:0 */
'use strict'

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

		Object.defineProperty(this, 'testEntry', {
			enumerable: false,
			writable: true
		})

		Object.assign(this, opts)
	}
}

// Actions
async function updateEditions (state) {
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
				entry: `${answers.mainEntry}.js`,
				testEntry: `${answers.testEntry}.js`,
				syntaxes: [
					'javascript',
					'esnext'
				],
				engines: {
					node: true,
					browsers: false
				}
			}))
			if (answers.modules) {
				editions[0].syntaxes.push('import')
			}
			else {
				editions[0].syntaxes.push('require')
			}
			if (answers.flowtype) {
				editions[0].syntaxes.push('flow type comments')
			}
		}
		else if (answers.language === 'coffeescript') {
			editions.push(
				new Edition({
					directory: answers.sourceDirectory,
					entry: `${answers.mainEntry}.coffee`,
					testEntry: `${answers.testEntry}.coffee`,
					syntaxes: [
						'coffeescript',
						'require'
					],
					engines: false
				}),
				new Edition({
					directory: 'edition:esnext',
					entry: `${answers.mainEntry}.js`,
					testEntry: `${answers.testEntry}.js`,
					syntaxes: [
						'javascript',
						'esnext',
						'require'
					],
					engines: {
						node: true,
						browsers: false
					},
					scripts: {
						'our:compile:edition:esnext': `coffee -bco ./edition:esnext ./${answers.sourceDirectory}`
					}
				})
			)
		}
		else if (answers.language === 'json') {
			editions.push(
				new Edition({
					description: 'JSON',
					directory: answers.sourceDirectory,
					entry: `${answers.mainEntry}.json`,
					testEntry: `${answers.testEntry}.js`,
					syntaxes: [
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
					directory: 'edition:browsers',
					entry: `${answers.mainEntry}.js`,
					testEntry: `${answers.testEntry}.js`,
					syntaxes: [
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
					directory: `edition:node:${answers.maximumSupportNodeVersion}`,
					entry: `${answers.mainEntry}.js`,
					testEntry: `${answers.testEntry}.js`,
					syntaxes: [
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
						directory: `edition:node:${answers.desiredNodeVersion}`,
						entry: `${answers.mainEntry}.js`,
						testEntry: `${answers.testEntry}.js`,
						syntaxes: [
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
						directory: `edition:node:${answers.minimumSupportNodeVersion}`,
						entry: `${answers.mainEntry}.js`,
						testEntry: `${answers.testEntry}.js`,
						syntaxes: [
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
					edition.description = `${answers.language} compiled for node.js ${edition.engines.node}`
				}
				else {
					edition.description = `${answers.language} compiled` // for node.js >=${answers.minimumSupportNodeVersion}`
				}
				if (edition.syntaxes.has('require')) {
					edition.description += ' with require for modules'
				}
				else if (edition.syntaxes.has('import')) {
					edition.description += ' with import for modules'
				}
			}
			if (edition.directory !== answers.sourceDirectory && edition.targets && !edition.scripts) {
				if (answers.language === 'coffeescript') {
					edition.scripts = {
						[`our:compile:${edition.directory}`]: `env BABEL_ENV=${edition.directory} coffee -bcto ./${edition.directory}/ ./${answers.sourceDirectory}`
					}
				}
				else {
					edition.scripts = {
						[`our:compile:${edition.directory}`]: `env BABEL_ENV=${edition.directory} babel --out-dir ./${edition.directory} ./${answers.sourceDirectory}`
					}
				}
			}
		})

		// prepare
		state.editions = editions
	}

	// log
	status('...updated editions')
}

module.exports = { updateEditions }
