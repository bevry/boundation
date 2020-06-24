'use strict'

const pathUtil = require('path')
const { exists, parse } = require('./fs.js')

function getNowName(nowData) {
	return nowData.name || null
}

function parseNowAliases(alias) {
	if (alias) {
		return Array.isArray(alias) ? alias : alias.split(/[,\s]+/)
	}
	return null
}

function getNowAliases(nowData) {
	return parseNowAliases(nowData.alias) || []
}

async function readWebsite(state) {
	const { cwd, packageData } = state

	// now
	const nowPath = pathUtil.resolve(cwd, 'now.json')
	let nowData = {}
	try {
		if (await exists(nowPath)) nowData = (await parse(nowPath)) || {}
	} catch (err) {}

	// apply
	state.nowData = Object.assign({}, packageData.now || {}, nowData)
}

async function updateWebsite(state) {
	const { answers, nowData } = state

	// add website deployment strategies
	if (answers.nowWebsite) {
		// add the versions we know
		const now = Object.assign(nowData || {}, {
			version: 2,
			name: answers.nowName,
			alias: parseNowAliases(answers.nowAliases),
		})
		// trim version 1 fields
		if (nowData && nowData.version !== 2) {
			delete now.type
			delete now.public
			delete now.files
			delete now.static
		}
		// next.js builder
		if (answers.website.includes('next')) {
			// remove old routes as they are no longer needed due to public directory now existing
			if (now.routes)
				now.routes = now.routes.filter(
					(route) =>
						['/favicon.ico', '/robots.txt'].includes(route.src) === false
				)
			// new format
			if (!now.builds) now.builds = [{ src: 'package.json', use: '@now/next' }]
		}
		// static builder
		if (answers.staticWebsite) {
			if (!now.builds)
				now.builds = [
					{ src: `${answers.staticDirectory}/**`, use: '@now/static' },
				]
		}
		// export
		state.nowData = now
	}
}

module.exports = {
	readWebsite,
	getNowAliases,
	getNowName,
	updateWebsite,
}
