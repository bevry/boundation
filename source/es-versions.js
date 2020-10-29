import { fetchNodeVersions, getNodeVersion } from './node-versions.js'
import versionCompare from 'version-compare'

const now = new Date()
const thisYear = now.getFullYear()

export function getESVersion(offset = 0, date = new Date()) {
	const year = date.getFullYear() + offset
	// january = 0
	const month = date.getMonth() + 1
	// es versions are ratified in june
	if (year > thisYear || (year === thisYear && month >= 6)) return 'ESNext'
	if (year > 2015 || (year === 2015 && month >= 6)) return 'ES' + year
	// before ES2015, it was ES5, which was ratified December 2009
	if (year > 2009 || (year === 2009 && month >= 12)) return 'ES5'
	// and before that it was ES3
	return 'ES3'
}

export function getAllESVersions() {
	let version,
		offset = 1
	const versions = new Set()
	do {
		version = getESVersion(offset, now)
		versions.add(version)
		offset--
	} while (version !== 'ES3')
	return Array.from(versions.values())
}

export async function getESVersionsForNodeVersions(nodeVersions) {
	await fetchNodeVersions()
	const versions = new Set()
	for (const nodeVersion of nodeVersions.sort(versionCompare).reverse()) {
		const meta = getNodeVersion(nodeVersion)
		versions.add(getESVersion(0, meta.start))
		versions.add(getESVersion(-1, meta.start))
	}
	return Array.from(versions.values())
}
