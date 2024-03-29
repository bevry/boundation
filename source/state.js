// external
import { has } from '@bevry/list'

// export
export const state = {
	cleaned: false,
	githubWorkflow: 'bevry', // will change if custom was detected
	answers: null,
	nodeVersionsOptional: [],
	packageData: {},
	vercelConfig: {},
	editions: [],
	get useEditionsAutoloader() {
		return this.nodeEditionsRequire.length >= 2
	},
	// active is not loadable, active is only kept
	get activeEditions() {
		return this.editions.filter((edition) => edition.active !== false)
	},
	// get activeEdition() {
	// 	return this.activeEditions[0]
	// },
	get typesEditions() {
		return this.activeEditions.filter((edition) => has(edition.tags, 'types'))
	},
	get typesEdition() {
		const typesEditions = this.typesEditions
		if (typesEditions.length > 1) {
			console.error(typesEditions)
			throw new Error(
				'there is more than one edition catered towards types, not sure what to do here...',
			)
		}
		return typesEditions[0]
	},
	get babelEditions() {
		return this.activeEditions.filter((edition) => edition.babel)
	},
	// get babelEdition() {
	// 	return this.babelEditions[0]
	// },
	get compiledEditions() {
		return this.activeEditions.filter(
			(edition) =>
				edition.engines && (edition.engines.node || edition.engines.browsers),
		)
	},
	// get compiledEdition() {
	// 	return this.compiledEditions[this.compiledEditions.length - 1]
	// },
	get nodeEditions() {
		return this.activeEditions.filter(
			(edition) => edition.engines && edition.engines.node,
		)
	},
	get nodeEdition() {
		return this.nodeEditions[0]
	},
	get nodeEditionsRequire() {
		return this.nodeEditions.filter((edition) => has(edition.tags, 'require'))
	},
	get nodeEditionRequire() {
		return this.nodeEditionsRequire[0]
	},
	get nodeEditionsImport() {
		return this.nodeEditions.filter((edition) => has(edition.tags, 'import'))
	},
	get nodeEditionImport() {
		return this.nodeEditionsImport[0]
	},
	get browserEditions() {
		return this.activeEditions.filter(
			(edition) => edition.engines && edition.engines.browsers,
		)
	},
	get browserEdition() {
		const browserEditions = this.browserEditions
		if (browserEditions.length > 1) {
			console.error(browserEditions)
			throw new Error(
				'there is more than one edition catered towards browsers, not sure what to do here...',
			)
		}
		return browserEditions[0]
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

export default state
