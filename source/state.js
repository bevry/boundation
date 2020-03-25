'use strict'

module.exports = {
	travisTLD: null, // or "org" or "com"
	answers: null,
	cwd: process.cwd(),
	packageData: {},
	nowData: {},
	nodeVersions: null,
	supportedNodeVersions: null,
	unsupportedNodeVersions: null,
	editions: [],
	get activeEditions() {
		return this.editions.filter((edition) => edition.active !== false)
	},
	get babelEditions() {
		return this.activeEditions.filter((edition) => edition.babel)
	},
	get compiledEditions() {
		return this.activeEditions.filter(
			(edition) =>
				edition.engines && (edition.engines.node || edition.engines.browsers)
		)
	},
	get nodeEditions() {
		return this.activeEditions.filter(
			(edition) => edition.engines && edition.engines.node
		)
	},
	get browserEditions() {
		return this.activeEditions.filter(
			(edition) => edition.engines && edition.engines.browsers
		)
	},
	get useEditionAutoloader() {
		return this.nodeEditions.length >= 2
	},
	get nodeEdition() {
		return this.nodeEditions[0]
	},
	get browserEdition() {
		const browserEditions = this.browserEditions
		if (browserEditions.length > 1) {
			console.error(browserEditions)
			throw new Error(
				'there is more than one edition catered towards browsers, not sure what to do here...'
			)
		}
		return browserEditions[0]
	},
	get compiledEdition() {
		return this.compiledEditions[this.compiledEditions.length - 1]
	},
	get sourceEdition() {
		const sourceEdition = this.editions[0]
		if (sourceEdition && sourceEdition.active === false) {
			throw new Error('source edition had .active=false which is not allowed')
		}
		return sourceEdition
	},
	userScripts: {},
	scripts: {},
}
