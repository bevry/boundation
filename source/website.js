import * as pathUtil from 'path'

import { pwd } from './data.js'
import { exists, parse } from './fs.js'

export function getNowName(nowData) {
	return nowData.name || null
}

export function parseNowAliases(alias) {
	if (alias) {
		return Array.isArray(alias) ? alias : alias.split(/[,\s]+/)
	}
	return null
}

export function getNowAliases(nowData) {
	return parseNowAliases(nowData.alias) || []
}

export async function readWebsite(state) {
	const { packageData } = state

	// now
	const nowPath = pathUtil.resolve(pwd, 'now.json')
	let nowData = {}
	try {
		if (await exists(nowPath)) nowData = (await parse(nowPath)) || {}
	} catch (err) {}

	// apply
	state.nowData = Object.assign({}, packageData.now || {}, nowData)
}

export async function updateWebsite(state) {
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
