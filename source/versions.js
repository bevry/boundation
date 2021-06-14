// builtin
import { join } from 'path'

// external
import testen from '@bevry/testen'
import { complement, intersect } from '@bevry/list'
import { filterNodeVersions } from '@bevry/node-versions'

// local
const { Versions } = testen
import { status } from './log.js'
import { writePackage } from './package.js'
import { updateRuntime } from './runtime.js'
import versionCompare from 'version-compare'
import { nodeMajorVersion, nodeMajorVersions } from './util.js'

// Update engines
export async function updateEngines(state) {
	const { answers, nodeEditionsRequire, nodeEditionsImport, packageData } =
		state
	const allPassedVersions = new Set()
	const serial =
		['testen', 'safefs', 'lazy-require'].includes(answers.name) ||
		answers.name.includes('docpad')

	// =================================
	// run each edition against the supported node version
	// to fetch the engines for each edition

	// if we have no editions suitable use `npm test` instead
	if (nodeEditionsRequire.length === 0 && nodeEditionsImport.length === 0) {
		// this can be the case if it is a website, or a mjs package
		status('determining engines for project...')
		const versions = new Versions(answers.nodeVersionsTested)
		await versions.load()
		await versions.install() // @todo if this fails (so no internet), it continues, this should not be the case
		const numbers = versions.map((version) => version.version)
		await versions.test(`${answers.packageManager} test`, serial)
		const passed = versions.json.passed || []
		if (passed.length === 0) {
			console.error(versions.messages.join('\n\n'))
			throw new Error(
				`There were no node versions [${numbers.join(
					', '
				)}] which the project's tests passed`
			)
		} else {
			packageData.engines.node = nodeMajorVersions(passed).join(' || ')
		}

		// add the versions to the list
		passed.forEach((version) =>
			allPassedVersions.add(nodeMajorVersion(version))
		)

		// log
		status(
			`...determined engines for project as [${
				packageData.engines.node
			}] against [${numbers.join(', ')}]`
		)
	} else {
		let recompile = false

		/* eslint no-loop-func:0 */
		for (const { list, nodeVersions, mode } of [
			{
				list: nodeEditionsImport,
				nodeVersions: filterNodeVersions(answers.nodeVersionsTested, {
					esm: true,
				}),
				mode: 'onlyAllSupported',
			},
			{
				list: nodeEditionsRequire,
				nodeVersions: answers.nodeVersionsTested,
				mode: 'allUnique',
			},
		]) {
			// Skip when we do not care about that module type
			if (list.length === 0) continue

			// Prepare
			const listPassedVersions = new Set()
			let skip = false
			let debug = ''

			// Determine
			for (const edition of list) {
				if (skip) {
					console.log(
						`The edition [${edition.directory}] will be trimmed, as a previous edition already passes all targets`
					)
					edition.active = false
					recompile = true
					continue
				}

				status(`determining engines for edition [${edition.directory}]...`)

				// determine the test script for the edition
				const test = answers.docpadPlugin
					? `npx docpad-plugintester --edition=${edition.directory}`
					: `node ./${join(edition.directory || '.', edition.test)}`

				// set the versions to test on as the supported node versions,
				// and the target node version
				const target =
					(edition.targets && nodeMajorVersion(edition.targets.node)) || null
				const versions = new Versions(nodeVersions.concat(target || []))

				// install and test the versions
				await versions.load()
				await versions.install()
				const numbers = versions.map((version) => version.version)
				await versions.test(test, serial)
				const passed = versions.json.passed || []
				const failed = versions.json.failed || []

				// update the sets
				const passedUnique = passed.filter(
					(version) =>
						listPassedVersions.has(nodeMajorVersion(version)) === false
				)
				const failedUnique = failed.filter(
					(version) =>
						listPassedVersions.has(nodeMajorVersion(version)) === false
				)
				const range = nodeMajorVersions(passed).join(' || ')
				skip = failed.length === 0

				// log the results
				debug += versions.messages.join('\n\n')
				console.log(
					[
						`target:      ${target || '*'}`,
						`passed:      ${passed.join(', ')}`,
						`.unique:     ${passedUnique.join(', ')}`,
						`failed:      ${failed.join(', ')}`,
						`.unique:     ${failedUnique.join(', ')}`,
						`range:       ${range}`,
					].join('\n')
				)

				// trim
				if (mode === 'allUnique') {
					// is this one redundant
					if (passedUnique.length === 0) {
						console.log(
							`The edition [${edition.directory}] will be trimmed, as it has no unique passing versions`
						)
						edition.active = false
						recompile = true
						continue
					}
				} else if (mode === 'onlyAllSupported') {
					// does this one pass for all targets?
					if (skip) {
						// if so, deactivate all those prior
						for (const priorEdition of list) {
							if (priorEdition === edition) break
							console.log(
								`The prior edition [${priorEdition.directory}] will be trimmed, as a latter edition supports its versions`
							)
							priorEdition.active = false
							recompile = true
							continue
						}
					}
				}

				// make engines the passed versions
				edition.engines.node = range

				// add the unique versions to the list
				passedUnique.forEach((version) =>
					listPassedVersions.add(nodeMajorVersion(version))
				)

				// log
				status(
					`...determined engines for edition [${edition.directory}] as [${
						edition.engines.node
					}] against [${numbers.join(', ')}]`
				)
			}

			// fetch the editions we've kept
			const keptEditions = Array.from(list.values()).filter(
				(edition) => edition.active
			)

			// if we only want one edition, verify we only have one edition
			if (mode === 'onlyAllSupported' && keptEditions.length !== 1) {
				console.error(debug.trim())
				throw new Error(
					`Multiple editions were kept [${keptEditions
						.map((edition) => edition.directory)
						.join(', ')}] when only one should have been.`
				)
			}

			// verify we have editions that pass on our targets
			for (const version of nodeVersions) {
				if (!listPassedVersions.has(version)) {
					console.error(debug.trim())
					throw new Error(
						`The kept editions [${keptEditions
							.map((edition) => edition.directory)
							.join(
								', '
							)}] still did not pass for the required node version [${version}]`
					)
				}
			}

			// add the list passed versions to the all passed versions
			listPassedVersions.forEach((i) => allPassedVersions.add(i))
		}

		// if there has been an editions change, try again with an updated runtime
		if (recompile) {
			return await updateRuntime(state)
		}
	}

	// =================================
	// update engines.node

	const supported = answers.nodeVersionsSupported
	const tested = answers.nodeVersionsTested
	const testedAndPassed = Array.from(allPassedVersions.values()).sort(
		versionCompare
	)
	const testedAndFailed = complement(tested, testedAndPassed)
	const testedAndSupported = intersect(tested, supported)
	const failedAndSupported = intersect(testedAndSupported, testedAndFailed)
	const passedAndUnsupported = complement(testedAndPassed, supported)
	const failedAndUnsupported = complement(testedAndFailed, supported)

	if (failedAndSupported.length) {
		throw new Error(
			`The project does not support the required versions: ${failedAndSupported.join(
				', '
			)}`
		)
	}

	if (passedAndUnsupported.length) {
		console.log(
			`The project supports the extra versions: ${passedAndUnsupported.join(
				', '
			)}`
		)
	}

	// if we are testing all supported versions
	// then make the engines the first passed version
	if (answers.nodeVersionSupportedMinimum >= answers.nodeVersionTestedMinimum) {
		packageData.engines.node = '>=' + testedAndPassed[0]
	} else {
		// otherwise use the supported version, as all our tests passed
		packageData.engines.node = '>=' + answers.nodeVersionSupportedMinimum
	}

	// apply the optional versions so that ci has access
	state.nodeVersionsOptional = failedAndUnsupported

	// =================================
	// update the package.json file

	await writePackage(state)
}
