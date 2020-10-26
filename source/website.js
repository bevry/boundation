import * as pathUtil from 'path'

import { pwd } from './data.js'
import { exists, parse } from './fs.js'

export function getVercelName(vercelConfig) {
	return vercelConfig.name || null
}

export function parseVercelAliases(alias) {
	if (alias) {
		return Array.isArray(alias) ? alias : alias.split(/[,\s]+/)
	}
	return null
}

export function getVercelAliases(vercelConfig) {
	return parseVercelAliases(vercelConfig.alias) || []
}

export async function readWebsite(state) {
	const { packageData } = state
	state.vercelConfig = Object.assign(
		{},
		packageData.now || {},
		packageData.vercel || {},
		(await parse(pathUtil.resolve(pwd, 'now.json'))) || {},
		(await parse(pathUtil.resolve(pwd, 'vercel.json'))) || {}
	)
}

export async function updateWebsite(state) {
	const { answers, vercelConfig } = state
	if (!vercelConfig) {
		throw new Error('updateWebsite was called before readWebsite')
	}

	// add website deployment strategies
	if (answers.vercelWebsite) {
		// trim version 1 fields
		if (vercelConfig.version !== 2) {
			delete vercelConfig.type
			delete vercelConfig.public
			delete vercelConfig.files
			delete vercelConfig.static
		}

		// add the versions we know
		vercelConfig.version = 2
		vercelConfig.name = answers.vercelName
		vercelConfig.alias = parseVercelAliases(answers.vercelAliases)

		// next.js builder
		if (answers.website.includes('next')) {
			// remove old routes as they are no longer needed due to public directory now existing
			if (vercelConfig.routes)
				vercelConfig.routes = vercelConfig.routes.filter(
					(route) =>
						['/favicon.ico', '/robots.txt'].includes(route.src) === false
				)
			// delete old format
			delete vercelConfig.build
		}

		// static builder
		if (answers.staticWebsite) {
			if (!vercelConfig.builds)
				vercelConfig.builds = [
					{ src: `${answers.staticDirectory}/**`, use: '@vercel/static' },
				]
		}
	}
}
