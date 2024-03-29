// builtin
import { join } from 'node:path'

// external
import { Versions } from '@bevry/testen'
import { complement, intersect } from '@bevry/list'
import { filterNodeVersions } from '@bevry/nodejs-versions'
import versionCompare from 'version-compare'
import { isAccessible } from '@bevry/fs-accessible'

// local
import { status, note } from './log.js'
import {
	writePackage,
	getPackageNodeEngine,
	setPackageNodeEngine,
} from './package.js'
import { updateRuntime } from './runtime.js'
import { nodeMajorVersion, nodeMajorVersions } from './util.js'
import { spawn } from './fs.js'

// Update engines
export async function updateEngines(state) {
	const { answers, nodeEditionsRequire, nodeEditionsImport, packageData } =
		state
	const allPassedVersions = new Set()
	const serial =
		['testen', 'safefs', 'lazy-require'].includes(answers.name) ||
		answers.name.includes('docpad')
	let useSpecificEngineVersions = false

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
		const numbers = versions.array.map((version) => version.version)
		await versions.test(`${answers.packageManager} test`, serial)
		const passed = versions.json.passed || []
		if (passed.length === 0) {
			console.error(versions.messages.join('\n\n'))
			throw new Error(
				`There were no node versions [${numbers.join(
					', ',
				)}] which the project's tests passed`,
			)
		} else {
			useSpecificEngineVersions = true
		}

		// add the versions to the list
		passed.forEach((version) =>
			allPassedVersions.add(nodeMajorVersion(version)),
		)

		// log
		status(
			`...determined engines for project as [${getPackageNodeEngine(
				packageData,
			)}] against [${numbers.join(', ')}]`,
		)
	} else {
		let recompile = false

		/* eslint no-loop-func:0 */
		// to determine the import edition, there can only be one, so use onlyAllSupported mode (to remove all editions that don't support everything (or at least just the supported versions), or fail)
		// to determine the require edition, there can be many, so use allUnique mode (to remove duplicates)
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
				mode: answers.editionsAutoloader ? 'allUnique' : 'onlyAllSupported',
			},
		]) {
			// Skip when we do not care about that module type
			if (list.length === 0) continue

			// Prepare
			const listPassedVersions = new Set()
			let skipRemainderBecausePassedEverything = false
			let debug = ''

			// Determine
			for (const edition of list) {
				// check if we need to skip because passed everything
				if (skipRemainderBecausePassedEverything) {
					note(
						`The edition [${edition.directory}] will be trimmed, as a previous edition already passed all targets`,
					)
					edition.active = false
					recompile = true
					continue
				}

				// target specified versions and the edition target
				const target =
					(edition.targets && nodeMajorVersion(edition.targets.node)) || null
				const targets = nodeVersions.concat(target || [])

				// check if we need to skip because unnecessary target
				if (target && listPassedVersions.has(target)) {
					note(
						`The edition [${edition.directory}] will be trimmed, as a previous edition already passed its target of ${target}`,
					)
					edition.active = false
					recompile = true
					continue
				}

				// log
				status(`determining engines for edition [${edition.directory}]...`)

				// run compile if needed
				if (edition.compileCommand && !(await isAccessible(edition.testPath))) {
					await spawn(edition.compileCommand)
				}

				// determine the test script for the edition
				const test = answers.docpadPlugin
					? `npx docpad-plugintester --edition=${edition.directory}`
					: `node ./${join(edition.directory || '.', edition.test)}`

				// install and test the versions
				const versions = new Versions(targets)
				await versions.load()
				await versions.install()
				const numbers = versions.array.map((version) => version.version)
				await versions.test(test, serial)
				const passed = versions.json.passed || []
				const failed = versions.json.failed || []

				// update the sets
				const passedUnique = passed.filter(
					(version) =>
						listPassedVersions.has(nodeMajorVersion(version)) === false,
				)
				const failedUnique = failed.filter(
					(version) =>
						listPassedVersions.has(nodeMajorVersion(version)) === false,
				)
				const range = nodeMajorVersions(passed).join(' || ')
				skipRemainderBecausePassedEverything = failed.length === 0

				// make engines of the edition the passed versions
				edition.engines.node = range

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
					].join('\n'),
				)

				// trim non-unique version
				if (passedUnique.length === 0) {
					// if this one has no unique passes, then it is redundant and can be trimmed
					note(
						`The edition [${edition.directory}] will be trimmed, as it has no unique passing versions`,
					)
					edition.active = false
					recompile = true
				} else {
					// had unique passing

					// handle onlyAllSupported mode
					if (
						mode === 'onlyAllSupported' &&
						skipRemainderBecausePassedEverything
					) {
						// if this one passes for all targets, then trim on all prior targets
						for (const priorEdition of list) {
							if (priorEdition === edition) break
							if (!priorEdition.active) continue
							note(
								`The prior edition [${priorEdition.directory}] will be trimmed, as it was partial`,
							)
							priorEdition.active = false
							recompile = true
						}
					}

					// add the unique versions to the list
					passedUnique.forEach((version) =>
						listPassedVersions.add(nodeMajorVersion(version)),
					)

					// log
					status(
						`...determined engines for edition [${edition.directory}] as [${
							edition.engines.node
						}] against [${numbers.join(', ')}]`,
					)
				}
			}

			// fetch the editions we've kept
			const keptEditions = Array.from(list.values()).filter(
				(edition) => edition.active,
			)

			// if we only want one edition, verify we only have one edition
			if (mode === 'onlyAllSupported' && keptEditions.length !== 1) {
				console.error(debug.trim())
				if (keptEditions.length === 0) {
					throw new Error(`No editions were kept, there should have been one.`)
				}
				throw new Error(
					`Multiple editions were kept [${keptEditions
						.map((edition) => edition.directory)
						.join(', ')}] when only one should have been.`,
				)
			}

			// verify we have editions that pass on our targets
			for (const version of nodeVersions) {
				if (
					!listPassedVersions.has(version) &&
					answers.nodeVersionsSupported.includes(version)
				) {
					// all kept editions should pass for all supported versions
					console.error(debug.trim())
					throw new Error(
						`The kept editions [${keptEditions
							.map((edition) => edition.directory)
							.join(
								', ',
							)}] still did not pass for the required node version [${version}]`,
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
		versionCompare,
	)
	const testedAndFailed = complement(tested, testedAndPassed)
	const testedAndSupported = intersect(tested, supported)
	const failedAndSupported = intersect(testedAndSupported, testedAndFailed)
	const passedAndUnsupported = complement(testedAndPassed, supported)
	const failedAndUnsupported = complement(testedAndFailed, supported)

	if (failedAndSupported.length) {
		throw new Error(
			`The project does not support the required versions: ${failedAndSupported.join(
				', ',
			)}`,
		)
	}

	if (passedAndUnsupported.length) {
		note(
			`The project supports the extra versions: ${passedAndUnsupported.join(
				', ',
			)}`,
		)
	}

	if (failedAndUnsupported.length) {
		note(
			`The project failed on the unsupported versions: ${failedAndUnsupported.join(
				', ',
			)}`,
		)
	}

	// @todo use state instead of mutating

	// handle expansion
	// @todo there is a bug when using expandNodeVersionsed, as it defaults to Node.js 18, 20, 21
	// which if there is engines >=10, and tests only pass on 16 and above, then it will change to >=16, as 18 is greater than 16.
	if (
		answers.expandNodeVersions &&
		versionCompare(answers.nodeVersionSupportedMinimum, testedAndPassed[0]) ===
			1
	) {
		// our tests revealed we support a lower version than originally supported so expand
		const oldValue = getPackageNodeEngine(packageData)
		const newValue = '>=' + testedAndPassed[0]
		setPackageNodeEngine(packageData, newValue)
		if (oldValue !== newValue) {
			note(
				`The project's Node.js engine has expanded from ${oldValue} to ${newValue}`,
			)
		} else {
			note(`The project's Node.js engine has stayed as ${oldValue}`)
		}
	} else {
		const oldValue = getPackageNodeEngine(packageData)
		const newValue =
			(useSpecificEngineVersions &&
				nodeMajorVersions(testedAndPassed).join(' || ')) ||
			(answers.website && `>=${answers.desiredNodeVersion}`) ||
			`>=${answers.nodeVersionSupportedMinimum}`
		setPackageNodeEngine(packageData, newValue)
		if (oldValue !== newValue) {
			note(
				`The project's Node.js engine has changed from ${oldValue} to ${newValue}`,
			)
		} else {
			note(`The project's Node.js engine has stayed as ${oldValue}`)
		}
	}

	// handle shrinking in case min test version failed
	if (
		answers.shrinkNodeVersions &&
		versionCompare(answers.nodeVersionTestedMinimum, testedAndPassed[0]) === -1
	) {
		const oldValue = answers.nodeVersionTestedMinimum
		const newValue = testedAndPassed[0]
		answers.nodeVersionTestedMinimum = newValue
		answers.nodeVersionsTested = testedAndPassed
		if (answers.expandNodeVersions === false) {
			state.nodeVersionsOptional = passedAndUnsupported
		}
		note(
			`The project's Node.js tests have been shrunk from ${oldValue} to ${newValue}`,
		)
	} else {
		state.nodeVersionsOptional = failedAndUnsupported
	}

	// =================================
	// update the package.json file

	await writePackage(state)
}
