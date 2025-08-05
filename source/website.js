// builtin
import * as pathUtil from 'node:path'

// local
import { pwd } from './data.js'
import { parse } from './fs.js'

/**
 * Get the Vercel project name from configuration
 * @param {object} vercelConfig - Vercel configuration object
 * @returns {string|null} The project name or null if not found
 */
export function getVercelName(vercelConfig) {
	return vercelConfig.name || null
}

/**
 * Parse alias string or array into an array of aliases
 * @param {string|string[]} alias - Alias string (comma/space separated) or array
 * @returns {string[]|null} Array of aliases or null if none provided
 */
export function parseVercelAliases(alias) {
	if (alias) {
		return Array.isArray(alias) ? alias : alias.split(/[,\s]+/)
	}
	return null
}

/**
 * Get Vercel aliases from configuration
 * @param {object} vercelConfig - Vercel configuration object
 * @returns {string[]} Array of alias strings
 */
export function getVercelAliases(vercelConfig) {
	return parseVercelAliases(vercelConfig.alias) || []
}

/**
 * Read website configuration from files
 * @param {object} state - Application state to update with website configuration
 * @returns {Promise<void>} Promise that resolves when website config is read
 */
export async function readWebsite(state) {
	const { packageData } = state
	state.vercelConfig = Object.assign(
		{},
		packageData.now || {},
		packageData.vercel || {},
		(await parse(pathUtil.resolve(pwd, 'now.json'))) || {},
		(await parse(pathUtil.resolve(pwd, 'vercel.json'))) || {},
	)
}

/**
 * Update website configuration based on user answers
 * @param {object} state - Application state containing answers and vercel configuration
 * @returns {Promise<void>} Promise that resolves when website config is updated
 */
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
			if (vercelConfig.routes) {
				vercelConfig.routes = vercelConfig.routes.filter(
					(route) =>
						['/favicon.ico', '/robots.txt'].includes(route.src) === false,
				)
			}
			// delete old format
			delete vercelConfig.build
		}

		// static builder
		if (answers.staticWebsite) {
			if (!vercelConfig.builds) {
				vercelConfig.builds = [
					{ src: `${answers.staticDirectory}/**`, use: '@vercel/static' },
				]
			}
		}
	}
}
