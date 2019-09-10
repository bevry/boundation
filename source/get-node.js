'use strict'

// External
const { fetch } = require('fetch-h2')

// Local
const now = new Date().getTime()

function isLTS([version, meta]) {
	if (meta.lts) {
		const start = new Date(meta.start).getTime()
		const end = new Date(meta.end).getTime()
		return now > start && now < end
	}
	return false
}

async function getMinimumNodeLTSVersion() {
	const response = await fetch(
		'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
	)
	const json = await response.json()
	const lts = Object.entries(json)
		.find(isLTS)[0]
		.replace('v', '')
	return lts
}

async function getMaximumNodeLTSVersion() {
	const response = await fetch(
		'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
	)
	const json = await response.json()
	const now = new Date().getTime()
	const lts = Object.entries(json)
		.reverse()
		.find(isLTS)[0]
		.replace('v', '')
	return lts
}

module.exports = { getMinimumNodeLTSVersion, getMaximumNodeLTSVersion }
