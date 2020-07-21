// External
import fetch from 'node-fetch'
import Errlop from 'errlop'

// Local
const now = new Date().getTime()

export function isLTS([version, meta]) {
	if (meta.lts) {
		const start = new Date(meta.start).getTime()
		const end = new Date(meta.end).getTime()
		return now > start && now < end
	}
	return false
}

export async function getNodeLTSVersions() {
	const url =
		'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
	try {
		const response = await fetch(url)
		const json = await response.json()
		const lts = Object.entries(json)
		return lts
	} catch (err) {
		throw new Errlop(`failed to fetch node.js LTS releases from ${url}`, err)
	}
}
export async function getMinimumNodeLTSVersion() {
	const lts = await getNodeLTSVersions()
	return lts.find(isLTS)[0].replace('v', '')
}

export async function getMaximumNodeLTSVersion() {
	const lts = await getNodeLTSVersions()
	return lts.reverse().find(isLTS)[0].replace('v', '')
}
