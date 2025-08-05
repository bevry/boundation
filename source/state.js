// internal
import { possibleTargets, allEcmascriptVersions } from './data.js'
import { ensureArray } from './util.js'

// external
import { first, has, unique, intersect } from '@bevry/list'

// export
const state = {
	cleaned: false,
	githubWorkflow: 'bevry', // will change if custom was detected
	answers: null,
	nodeVersionsOptional: [],
	packageData: {},
	vercelConfig: {},
	editions: [],
	get useEditionsAutoloader() {
		const editionsAutoloader = this.answers?.editionsAutoloader
		const nodeEditionsRequire = this.nodeEditionsRequire
		const useEditionsAutoloader =
			editionsAutoloader && nodeEditionsRequire.length >= 2
		return useEditionsAutoloader
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
	get editionTargets() {
		let editionTargets = new Set()
		for (const edition of this.activeEditions) {
			for (const tag of edition.tags) {
				editionTargets.add(tag)
			}
		}
		editionTargets = intersect(Array.from(editionTargets), possibleTargets)
		return editionTargets
	},
	get usedTargets() {
		const usedTargets = unique([
			// answered languages
			...(this.answers?.languages || []),
			// answered ecmascript versions
			...ensureArray(this.answers?.ecmascriptVersion),
			// ecmascript versions and languages for our editions
			...this.editionTargets,
		])
		return usedTargets
	},
	get ecmascriptTargets() {
		const ecmascriptTargets = intersect(
			allEcmascriptVersions,
			this.editionTargets,
		)
		return ecmascriptTargets
		/*
		If you are after the resultant ecmascript targets, you can use this:
		Which is way simpler than updating the targets and engines of the editions.
		And is way simpler than the following, even though it is actually equivalent:
		await fetchAllCompatibleESVersionsForNodeVersions(
			await fetchSupportedNodeVersions({
				range: getPackageNodeEngine(packageData)
			}),
		)
		The reason you would want to do any of this, would be for eslint-config-bevry to adjust ecmascript version support.
		However, in the end, we just inlined the above.
		*/
	},
	get ecmascriptVersionLowest() {
		const ecmascriptTargets = this.ecmascriptTargets
		if (ecmascriptTargets.length) {
			const ecmascriptVersionLowest = first(ecmascriptTargets.reverse()) || ''
			return ecmascriptVersionLowest
		} else {
			return ''
		}
		// return intersect(
		// 	allTypescriptEcmascriptVersions,
		// 	toLowerCase(
		// 		await fetchExclusiveCompatibleESVersionsForNodeVersions([
		// 			answers.desiredNodeVersion,
		// 		]),
		// 	),
		// )[0]
	},
	get ecmascriptVersionRange() {
		const ecmascriptVersionLowest = this.ecmascriptVersionLowest
		if (ecmascriptVersionLowest) {
			return `>= ${ecmascriptVersionLowest}`
		} else {
			return ''
		}
	},
	userScripts: {},
	scripts: {},
}

export default state
