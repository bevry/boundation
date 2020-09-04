// External
import fetch from 'node-fetch'
import Errlop from 'errlop'
import { versionComparator } from './versions.js'

// Local
const now = new Date().getTime()

/*
interface Version {
	start: Date
	lts?: Date
	end: Date
	maintenance?: Date
	codename?: string
	version: string
}
*/

let nodeVersions = null
let nodeLtsVersions = null
let nodeCurrentVersions = null
let nodeMinimumCurrentVersion = null
let nodeMaximumCurrentVersion = null
export async function prepareNodeVersions() {
	if (nodeVersions) return true
	const url =
		'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
	try {
		const response = await fetch(url)
		const json = await response.json()
		nodeVersions = Object.entries(json)
			.map(function ([key, meta]) {
				meta.version = key.replace('v', '')
				meta.start = new Date(meta.start)
				meta.end = new Date(meta.end)
				if (meta.maintenance) meta.maintenance = new Date(meta.maintenance)
				if (meta.lts) meta.lts = new Date(meta.lts)
				return meta
			})
			.filter((meta) => {
				const start = meta.start.getTime()
				return now > start
			})
		nodeLtsVersions = nodeVersions.filter((meta) => meta.lts)
		nodeCurrentVersions = nodeLtsVersions.filter((meta) => {
			const end = meta.end.getTime()
			return now < end
		})
		nodeMinimumCurrentVersion = nodeCurrentVersions[0].version
		nodeMaximumCurrentVersion =
			nodeCurrentVersions[nodeCurrentVersions.length - 1].version
		return true
	} catch (err) {
		throw new Errlop(`failed to fetch node.js LTS releases from ${url}`, err)
	}
}

export async function getNodeMinimumCurrentVersion() {
	await prepareNodeVersions()
	return nodeMinimumCurrentVersion
}

export async function getNodeMaximumCurrentVersion() {
	await prepareNodeVersions()
	return nodeMaximumCurrentVersion
}

export async function getNodeVersions() {
	await prepareNodeVersions()
	return nodeVersions.map((meta) => meta.version).reverse()
}

export async function getNodeCurrentVersions() {
	await prepareNodeVersions()
	return nodeCurrentVersions.reverse()
}

export async function isNodeCurrentVersion(version) {
	await prepareNodeVersions()
	return (
		versionComparator(version, nodeMinimumCurrentVersion) >= 0 &&
		versionComparator(version, nodeMaximumCurrentVersion) <= 0
	)
}

export async function isNodeMaximumCurrentVersion(version) {
	await prepareNodeVersions()
	return versionComparator(version, nodeMaximumCurrentVersion) === 0
}
