'use strict'

module.exports = {
	cwd: process.cwd(),
	packageData: null,
	nodeVersions: null,
	supportedNodeVersions: null,
	unsupportedNodeVersions: null,
	editions: [],
	get activeEditions () {
		return this.editions.filter((edition) => edition.active !== false)
	},
	get compiledEditions () {
		return this.activeEditions.filter((edition) => edition.engines && (edition.engines.node || edition.engines.browsers))
	},
	get nodeEditions () {
		return this.activeEditions.filter((edition) => edition.engines && edition.engines.node)
	},
	get browserEditions () {
		return this.activeEditions.find((edition) => edition.engines && edition.engines.browsers)
	},
	get useEditionAutoloader () {
		return this.nodeEditions.length >= 2
	},
	get nodeEdition () {
		return this.nodeEditions[0]
	},
	get browserEdition () {
		return this.browserEditions[0]
	},
	get compiledEdition () {
		return this.compiledEditions[this.compiledEditions.length - 1]
	},
	get sourceEdition () {
		const sourceEdition = this.editions[0]
		if (sourceEdition.active === false) {
			throw new Error('source edition had .active=false which is not allowed')
		}
		return sourceEdition
	},
	userScripts: {},
	scripts: {}
}
