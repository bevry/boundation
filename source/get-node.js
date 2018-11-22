'use strict'

// External
const fetch = require('node-fetch')

async function getMinimumNodeLTSVersion() {
	const response = await fetch(
		'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
	)
	const json = await response.json()
	const now = new Date().getTime()
	const lts = Object.keys(json)
		.find(function(version) {
			const meta = json[version]
			if (meta.lts) {
				const end = new Date(meta.lts).getTime()
				if (end <= now) {
					return true
				}
			}
			return false
		})
		.replace('v', '')
	return lts
}

async function getMaximumNodeLTSVersion() {
	const response = await fetch(
		'https://raw.githubusercontent.com/nodejs/Release/master/schedule.json'
	)
	const json = await response.json()
	const now = new Date().getTime()
	const lts = Object.keys(json)
		.reverse()
		.find(function(version) {
			const meta = json[version]
			if (meta.lts) {
				const lts = new Date(meta.lts).getTime()
				if (lts <= now) {
					return true
				}
			}
			return false
		})
		.replace('v', '')
	return lts
}

module.exports = { getMinimumNodeLTSVersion, getMaximumNodeLTSVersion }
