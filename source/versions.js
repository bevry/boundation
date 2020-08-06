// External
import { join } from 'path'

// Local
import { allNodeVersions } from './data.js'
import testen from '@bevry/testen'
const { Versions } = testen
import { status } from './log.js'
import { writePackage } from './package.js'
import { without, has } from './util.js'
import { updateRuntime } from './runtime.js'

// Compare to versions simplify
// Works for 1, 1.1, or 1.1.1, or 1.1.1 - sadasd
export function versionComparator(a, b) {
	// https://github.com/substack/versionComparator-compare/pull/4
	const pa = String(a).split('.')
	const pb = String(b).split('.')
	for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
		const na = Number(pa[i])
		const nb = Number(pb[i])
		if (na > nb) return 1
		if (nb > na) return -1
		if (!isNaN(na) && isNaN(nb)) return 1
		if (isNaN(na) && !isNaN(nb)) return -1
	}
	return 0
}

export async function updateVersions(state) {
	const { answers } = state

	// fetch node versions
	state.nodeVersions = allNodeVersions.filter(
		(version) =>
			versionComparator(version, answers.minimumTestNodeVersion) >= 0 &&
			versionComparator(version, answers.maximumTestNodeVersion) <= 0
	)
	state.unsupportedNodeVersions = state.nodeVersions.filter(
		(version) =>
			versionComparator(version, answers.minimumSupportNodeVersion) < 0 ||
			versionComparator(version, answers.maximumSupportNodeVersion) > 0
	)
	state.supportedNodeVersions = state.nodeVersions.filter(
		(version) =>
			versionComparator(version, answers.minimumSupportNodeVersion) >= 0 &&
			versionComparator(version, answers.maximumSupportNodeVersion) <= 0
	)
}

export function nodeMajorVersion(value) {
	if (typeof value === 'number') {
		value = String(value)
	} else if (typeof value !== 'string') {
		return null
	}
	return value.startsWith('0')
		? value.split('.').slice(0, 2).join('.')
		: value.split('.')[0]
}

export function nodeMajorVersions(array) {
	return array.map((version) => nodeMajorVersion(version))
}
// Update engines
export async function updateEngines(state) {
	const {
		answers,
		nodeEditionsAutoloader,
		supportedNodeVersions,
		nodeVersions,
		packageData,
	} = state
	const allPassedVersions = new Set()
	const serial =
		['testen', 'safefs', 'lazy-require'].includes(answers.name) ||
		answers.name.includes('docpad')

	// =================================
	// run each edition against the supported node version
	// to fetch the engines for each edition

	// if we have no editions suitable for autoloading, do this
	if (nodeEditionsAutoloader.length === 0) {
		// this can be the case if it is a website, or a mjs package
		status('determining engines for project...')
		const versions = new Versions(nodeVersions)
		await versions.load()
		await versions.install()
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
		let skip = false
		let debug = ''

		/* eslint no-loop-func:0 */
		for (const edition of nodeEditionsAutoloader) {
			if (skip) {
				console.log(
					`The edition [${edition.directory}] will be trimmed, as a previous edition already passes all targets`
				)
				edition.active = false
				recompile = true
				continue
			}

			status(`determining engines for edition [${edition.directory}]...`)

			// Fetch the target and the range
			const target =
				(edition.targets && nodeMajorVersion(edition.targets.node)) || null

			// determine the test script for the edition
			const test = answers.docpadPlugin
				? `npx docpad-plugintester --edition=${edition.directory}`
				: `node ./${join(edition.directory || '.', edition.test)}`

			// set the versions to test on as the supported node versions,
			// and the target node version
			const versions = new Versions(supportedNodeVersions.concat(target || []))

			// install and test the versions
			await versions.load()
			await versions.install()
			const numbers = versions.map((version) => version.version)
			await versions.test(test, serial)
			const passed = versions.json.passed || []
			const failed = versions.json.failed || []

			// update the sets
			const passedUnique = passed.filter(
				(version) => allPassedVersions.has(nodeMajorVersion(version)) === false
			)
			const failedUnique = failed.filter(
				(version) => allPassedVersions.has(nodeMajorVersion(version)) === false
			)
			const trim = passedUnique.length === 0
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
					`trim:        ${trim ? 'yes' : 'no'}`,
				].join('\n')
			)

			// trim
			if (trim) {
				console.log(
					`The edition [${edition.directory}] will be trimmed, as it has no unique passing versions`
				)
				edition.active = false
				recompile = true
				continue
			}

			// make engines the passed versions
			edition.engines.node = range

			// add the unique versions to the list
			passedUnique.forEach((version) =>
				allPassedVersions.add(nodeMajorVersion(version))
			)

			// log
			status(
				`...determined engines for edition [${edition.directory}] as [${
					edition.engines.node
				}] against [${numbers.join(', ')}]`
			)
		}

		// verify we have editions that pass on our targets
		for (const version of supportedNodeVersions) {
			if (!allPassedVersions.has(version)) {
				console.error(debug.trim())
				throw new Error(
					`No editions passed for required node version [${version}]`
				)
			}
		}

		// if there has been an editions change, try again with an updated runtime
		if (recompile) {
			return await updateRuntime(state)
		}
	}

	// =================================
	// update engines.node

	const passed = Array.from(allPassedVersions.values()).sort(versionComparator)
	const supported = Array.from(supportedNodeVersions.values()).sort(
		versionComparator
	)
	const unsupported = without(supported, passed)
	const extra = without(passed, supported)

	if (unsupported.length) {
		throw new Error(
			`The project does not support the required versions: ${unsupported.join(
				', '
			)}`
		)
	}
	if (extra.length) {
		console.log(`The project supports the extra versions: ${extra.join(', ')}`)
	}

	// if we are testing all supported versions
	// then make the engines the first passed version
	if (answers.minimumSupportNodeVersion >= answers.minimumTestNodeVersion) {
		packageData.engines.node = '>=' + passed[0]
	} else {
		// otherwise use the supported version, as all our tests passed
		packageData.engines.node = '>=' + answers.minimumSupportNodeVersion
	}

	// =================================
	// update the package.json file

	await writePackage(state)
}
