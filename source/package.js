// builtin
import * as pathUtil from 'node:path'

// external
import { is as isBevryOrganisation } from '@bevry/github-orgs'
import { intersect, unique, complement } from '@bevry/list'
import arrangekeys from 'arrangekeys'
import arrangePackageData from 'arrange-package-json'
import { isAccessible } from '@bevry/fs-accessible'
import write from '@bevry/fs-write'
import {
	Fellow,
	getBackers,
	renderBackers,
	getGitHubSlugFromPackageData,
	getGitHubSlugFromUrl,
	getRepositoryIssuesUrlFromGitHubSlugOrUrl,
	getRepositoryUrlFromPackageData,
	getRepositoryUrlFromUrlOrGitHubSlug,
	getRepositoryWebsiteUrlFromGitHubSlugOrUrl,
	hasCredentials,
} from '@bevry/github-api'
import { trimEmptyKeys } from 'trim-empty-keys'

// local
import {
	defaultDeploy,
	ensureScript,
	fixBalupton,
	fixAuthor,
	fixAuthors,
} from './util.js'
import { pwd, pastBevrySponsors, allLanguages } from './data.js'
import { status } from './log.js'
import { echoExists, parse } from './fs.js'
import { getVercelName } from './website.js'

// Prepare
const mandatoryScriptsList =
	'our:setup our:compile our:meta our:verify our:deploy our:release test'.split(
		' ',
	)

// ====================================
// Helpers

/**
 * Check if using NPM package manager
 * @returns {Promise<boolean>} True if package-lock.json exists
 */
export async function isNPM() {
	const npmlock = await isAccessible(`./package-lock.json`)
	return npmlock
}

/**
 * Check if using PNPM package manager
 * @returns {Promise<boolean>} True if pnpm-lock.yaml exists
 */
export async function isPNPM() {
	const pnpm = await isAccessible(`./pnpm-lock.yaml`)
	return pnpm
}

/**
 * Check if using Yarn package manager
 * @returns {Promise<boolean>} True if yarn.lock or .pnp files exist
 */
export async function isYARN() {
	const pnpjs = await isAccessible(`./.pnp.js`)
	const pnp = await isAccessible(`./.pnp`)
	const yarnlock = await isAccessible(`./yarn.lock`)
	const yarn = yarnlock || pnp || pnpjs
	return yarn
}

/**
 * Check if a URL is a git repository URL
 * @param {string} input - The URL to check
 * @returns {boolean} True if the input is a git URL
 */
export function isGitUrl(input) {
	return /\.git$/.test(input)
}

/**
 * Get repository URL from input string or GitHub slug
 * @param {string} [input] - Input string that might be a URL or GitHub slug
 * @returns {string|null} Repository URL or null if invalid
 */
export function getRepoUrl(input = '') {
	return getRepositoryUrlFromUrlOrGitHubSlug(input) || null
}

/**
 * Convert GitHub slug to repository website URL
 * @param {string} [githubSlug] - GitHub repository slug (owner/repo)
 * @returns {string|null} Repository website URL or null if invalid
 */
export function slugToWebsite(githubSlug = '') {
	return getRepositoryWebsiteUrlFromGitHubSlugOrUrl(githubSlug) || null
}

/**
 * Convert GitHub slug to repository issues URL
 * @param {string} [githubSlug] - GitHub repository slug (owner/repo)
 * @returns {string|null} Repository issues URL or null if invalid
 */
export function slugToIssues(githubSlug = '') {
	return getRepositoryIssuesUrlFromGitHubSlugOrUrl(githubSlug) || null
}

/**
 * Extract GitHub slug from repository URL
 * @param {string} [input] - Repository URL to extract slug from
 * @returns {string|null} GitHub slug (owner/repo) or null if invalid
 */
export function repoToSlug(input = '') {
	return getGitHubSlugFromUrl(input) || null
}

/**
 * Extract GitHub username from repository URL
 * @param {string} [input] - Repository URL to extract username from
 * @returns {string|null} GitHub username or null if invalid
 */
export function repoToUsername(input = '') {
	const githubSlug = getGitHubSlugFromUrl(input)
	return (githubSlug && githubSlug.split('/')[0]) || null
}

/**
 * Extract GitHub project name from repository URL
 * @param {string} [input] - Repository URL to extract project name from
 * @returns {string|null} GitHub project name or null if invalid
 */
export function repoToProject(input = '') {
	const githubSlug = getGitHubSlugFromUrl(input)
	return (githubSlug && githubSlug.split('/')[1]) || null
}

/**
 * Get package name from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Package name or null if not set
 */
export function getPackageName(packageData) {
	return packageData.name || null
}

/**
 * Get package description from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Package description or null if not set
 */
export function getPackageDescription(packageData) {
	return packageData.description || null
}

/**
 * Get package keywords as comma-separated string from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Package keywords as comma-separated string or null if not set
 */
export function getPackageKeywords(packageData) {
	return (packageData.keywords && packageData.keywords.join(', ')) || null
}

/**
 * Get Node.js engine version from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Node.js engine version or null if not set
 */
export function getPackageNodeEngine(packageData) {
	return (packageData.engines && packageData.engines.node) || null
}

/**
 * Get numeric Node.js engine version from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Numeric Node.js engine version or null if not set
 */
export function getPackageNodeEngineVersion(packageData) {
	const nodeEngine = getPackageNodeEngine(packageData)
	if (nodeEngine) return nodeEngine.replace(/[^0-9]+/, '') || null
	return null
}

/**
 * Set Node.js engine version in package.json data
 * @param {object} packageData - Package.json data object to modify
 * @param {string} nodeEngine - Node.js engine version to set
 * @returns {void}
 */
export function setPackageNodeEngine(packageData, nodeEngine) {
	if (!packageData.engines) packageData.engines = {}
	packageData.engines.node = nodeEngine
}

/**
 * Check if package has documentation-related dependencies
 * @param {object} packageData - Package.json data object
 * @returns {boolean} True if package has documentation dependencies
 */
export function getPackageDocumentationDependency(packageData) {
	if (packageData.devDependencies) {
		if (
			packageData.devDependencies.documentation ||
			packageData.devDependencies.yuidocjs ||
			packageData.devDependencies.biscotto
		) {
			return true
		}
	}
	return false
}

/**
 * Check if package has Flow type checking dependency
 * @param {object} packageData - Package.json data object
 * @returns {boolean|null} True if Flow dependency exists, null otherwise
 */
export function getPackageFlowtypeDependency(packageData) {
	return (
		(packageData.devDependencies &&
			Boolean(packageData.devDependencies['flow-bin'])) ||
		null
	)
}

/**
 * Get tags from the first source edition in package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string[]|null} Array of tags from the first edition, or null if no tags
 */
export function getPackageSourceEditionTags(packageData) {
	const edition =
		packageData.editions &&
		packageData.editions.length &&
		packageData.editions[0]
	const tags = (edition && (edition.tags || edition.syntaxes)) || []
	return tags.length ? tags : null
}

/**
 * Does the source code use ESM?
 * @param {object} packageData - Package.json data object
 * @returns {boolean} True if source code uses ESM import syntax
 */
export function isSourceModule(packageData) {
	const tags = getPackageSourceEditionTags(packageData) || []
	return tags.includes('import')
}

/**
 * Does the exported package use ESM by default?
 * @param {object} packageData - Package.json data object
 * @returns {boolean} True if package type is 'module'
 */
export function isPackageModule(packageData) {
	return packageData.type === 'module'
}

/**
 * Get repository URL from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Repository URL or null if not set
 */
export function getPackageRepoUrl(packageData) {
	return getRepositoryUrlFromPackageData(packageData) || null
}

/**
 * Get package author from package.json data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Package author or null if not set
 */
export function getPackageAuthor(packageData) {
	return packageData.author || null
}

/**
 * Check if package has editions configuration
 * @param {object} packageData - Package.json data object
 * @returns {boolean} True if package has editions
 */
export function hasEditions(packageData) {
	return packageData.editions && Boolean(packageData.editions.length)
}

/**
 * Get specific script from package.json
 * @param {object} packageData - Package.json data object
 * @param {string} key - Script name to retrieve
 * @returns {string|null} Script content or null if not found
 */
export function getPackageScript(packageData, key) {
	return (packageData.scripts && packageData.scripts[key]) || null
}

/**
 * Check if package has specific script
 * @param {object} packageData - Package.json data object
 * @param {string} key - Script name to check for
 * @returns {boolean} True if script exists
 */
export function hasPackageScript(packageData, key) {
	return Boolean(getPackageScript(packageData, key))
}

/**
 * Check if package has script with specific prefix
 * @param {object} packageData - Package.json data object
 * @param {string} key - Script prefix to check for
 * @returns {boolean} True if script with prefix exists
 */
export function hasPackageScriptPrefix(packageData, key) {
	return Boolean(
		Object.keys(packageData.scripts || {}).find((value) =>
			value.startsWith(key),
		),
	)
}

/**
 * Check if package has documentation generation script
 * @param {object} packageData - Package.json data object
 * @returns {boolean} True if documentation script exists
 */
export function hasDocumentation(packageData) {
	return hasPackageScript(packageData, 'our:meta:docs')
}

/**
 * Check if package has multiple editions
 * @param {object} packageData - Package.json data object
 * @returns {boolean|null} True if multiple editions exist, null if no editions
 */
export function hasMultipleEditions(packageData) {
	if (packageData.editions) {
		return packageData.editions.length > 1
	}
	return null
}

/**
 * Check if package has a specific dependency
 * @param {object} packageData - Package.json data object
 * @param {string} key - Dependency name to check for
 * @returns {boolean} True if dependency exists in any dependency section
 */
export function hasPackageDependency(packageData, key) {
	const {
		dependencies = {},
		devDependencies = {},
		peerDependencies = {},
	} = packageData
	return (
		Boolean(dependencies[key]) ||
		Boolean(devDependencies[key]) ||
		Boolean(peerDependencies[key])
	)
}

/**
 * Get programming languages used by the package based on dependencies, file extensions, and configuration
 * @param {object} packageData - Package.json data object
 * @param {boolean} [website] - Whether this is a website project
 * @param {boolean} [nextWebsite] - Whether this is a Next.js website project
 * @returns {string[]} Array of programming language names, in order of preference.
 */
export function getPackageLanguages(
	packageData,
	website = false,
	nextWebsite = false,
) {
	const languages = []

	// use the source edition tags if available
	const languagesFromSourceEdition = intersect(
		allLanguages,
		getPackageSourceEditionTags(packageData) || [],
	)
	languages.push(...languagesFromSourceEdition)

	// if no source edition languages, then determine the languages by analysing other criteria
	if (languages.length === 0) {
		// dependency languages
		if (hasPackageDependency(packageData, 'typescript')) {
			languages.push('typescript')
		}
		if (
			hasPackageDependency(packageData, 'coffee-script') ||
			hasPackageDependency(packageData, 'coffeescript')
		) {
			languages.push('coffeescript')
		}

		// main entry languages
		if (packageData.main) {
			if (/\.[mc]?tsx?$/.test(packageData.main)) {
				languages.push('typescript')
			} else if (/\.[mc]?jsx?$/.test(packageData.main)) {
				languages.push('esnext')
			} else if (/\.json$/.test(packageData.main)) {
				languages.push('json')
			} else if (/\.coffee$/.test(packageData.main)) {
				languages.push('coffeescript')
			}

			// jsx
			if (/\.[mc]?[tj]sx$/.test(packageData.main)) {
				languages.push('jsx')
			}
		}

		// website languages
		if (nextWebsite || hasPackageDependency(packageData, 'react')) {
			languages.push('react', 'jsx', 'html', 'css')
		} else if (website) {
			languages.push('html', 'css')
		}

		// keyword languages if still empty
		if (languages.length === 0) {
			const languagesFromKeywords = intersect(
				allLanguages,
				getPackageKeywords(packageData) || [],
			)
			languages.push(...languagesFromKeywords)
		}
	}

	// return the unique result
	return unique(languages)
}

/**
 * Get a property value from package.json data
 * @param {object} packageData - Package.json data object
 * @param {string} key - Property key to retrieve
 * @returns {*} The value of the requested property
 */
export function getPackageProperty(packageData, key) {
	return packageData[key]
}

/**
 * Get the organization name from package data
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Organization name or null if not found
 */
export function getPackageOrganisation(packageData) {
	return repoToUsername(getGitHubSlugFromPackageData(packageData)) || null
}

/**
 * Check if package is a DocPad plugin
 * @param {object} packageData - Package.json data object
 * @returns {boolean} True if package is a DocPad plugin
 */
export function isPackageDocPadPlugin(packageData) {
	return (
		(packageData.name && packageData.name.startsWith('docpad-plugin-')) || false
	)
}

/**
 * Get basename from a file path (filename without directory and extension)
 * @param {string} path - File path to extract basename from
 * @returns {string|null} Basename or null if invalid path
 */
export function getBasename(path) {
	// remove dirname, then remove extension
	return (
		(typeof path === 'string' &&
			path.replace(/^.+\//, '').replace(/\.[^.]+$/, '')) ||
		null
	)
}

/**
 * Get the package test entry point
 * @param {object} packageData - Package.json data object
 * @returns {string|null} Test entry filename or null if not found
 */
export function getPackageTestEntry(packageData) {
	if (packageData) {
		if (isPackageDocPadPlugin(packageData)) {
			return 'test'
		} else if (packageData.scripts && packageData.scripts.test) {
			const result = packageData.scripts.test.match(
				/^node(?: --[a-zA-Z0-9_]+)* (?:[^/]+\/)*([^.]+)\.js/,
			) /* fetches filename without ext */
			return (result && result[1]) || null
		}
	}
	return null
}

/**
 * Return the bin entry as a string (if single bin entry), or as an object of strings that point to the same bin entry (if multiple bin names)
 * @param {object} packageData - Package.json data object
 * @param {string} binEntry - New bin entry path
 * @returns {string|object|null} Bin entry as string or object, null if no binEntry
 */
export function newPackageBinEntry(packageData, binEntry) {
	if (!binEntry) return null
	if (typeof packageData.bin === 'string') {
		return binEntry
	} else if (typeof packageData.bin === 'object') {
		const result = {}
		for (const key of Object.keys(packageData.bin)) {
			result[key] = binEntry
		}
		return result
	} else {
		// not yet created, so add
		return binEntry
	}
}

/**
 * Get package bin entry from package.json
 * @param {object} packageData - Package.json data object
 * @param {boolean} [basename] - Whether to return basename or full path
 * @returns {string|null} Bin entry path or null if not found
 */
export function getPackageBinEntry(packageData, basename = true) {
	const bin = packageData.bin
	if (bin) {
		const entry = typeof bin === 'string' ? bin : Object.values(bin)[0]
		return basename ? getBasename(entry) : entry
	}
	return null
}

/**
 * Get package main entry (index) filename
 * @param {object} packageData - Package.json data object
 * @returns {Promise<string|null>} Main entry filename or null if not found
 */
export async function getPackageIndexEntry(packageData) {
	if (packageData && isPackageDocPadPlugin(packageData)) {
		return 'index'
	}
	return getBasename(packageData && packageData.main)
}

/**
 * Get package Node.js entry filename
 * @param {object} packageData - Package.json data object
 * @returns {Promise<string|null>} Node entry filename or null if not found
 */
export async function getPackageNodeEntry(packageData) {
	if (packageData && isPackageDocPadPlugin(packageData)) {
		return 'index'
	}
	return getBasename(
		(await echoExists('source/node.ts')) ||
			(await echoExists('source/node.coffee')) ||
			(await echoExists('source/node.mjs')) ||
			(await echoExists('source/node.js')),
	)
	// don't use packageData.node
	// have them set it via package.json:boundation:nodeEntry
	// as otherwise when you delete the node entry file, to say use index entry file instead, the change won't be automatically detected
}

/**
 * Get package Deno entry filename
 * @param {object} packageData - Package.json data object
 * @returns {Promise<string|null>} Deno entry filename or null if not found
 */
export async function getPackageDenoEntry(packageData) {
	return getBasename(
		(await echoExists('source/deno.ts')) || (packageData && packageData.deno),
	)
	// don't use packageData.deno
	// have them set it via package.json:boundation:denoEntry
	// as otherwise when you delete the deno entry file, to say use index entry file instead, the change won't be automatically detected
}

/**
 * Get package browser entry filename
 * @returns {Promise<string|null>} Browser entry filename or null if not found
 */
export async function getPackageBrowserEntry() {
	return getBasename(
		(await echoExists('source/browser.ts')) ||
			(await echoExists('source/browser.coffee')) ||
			(await echoExists('source/browser.mjs')) ||
			(await echoExists('source/browser.js')),
	)
	// don't use packageData.browser
	// have them set it via package.json:boundation:browserEntry
	// as otherwise when you delete the browser entry file, to say use index entry file instead, the change won't be automatically detected
}

/**
 * Get website deployment type based on dependencies and configuration
 * @param {object} packageData - Package.json data object
 * @param {object} vercelConfig - Vercel configuration object
 * @returns {string} Website type (vercel: next.js, vercel: docpad, vercel: static, vercel: custom, surge, custom)
 */
export function getWebsiteType(packageData, vercelConfig) {
	if (hasPackageDependency(packageData, 'next')) {
		return 'vercel: next.js'
	}
	if (hasPackageDependency(packageData, 'docpad')) {
		return 'vercel: docpad'
	}
	if (getVercelName(vercelConfig)) {
		if (
			vercelConfig.builds &&
			vercelConfig.builds.length &&
			vercelConfig.builds[0].use === '@vercel/static'
		) {
			return 'vercel: static'
		}
		return 'vercel: custom'
	}
	if (hasPackageDependency(packageData, 'surge')) {
		return 'surge'
	}
	return 'custom'
}

/**
 * Get project type (website or package)
 * @param {object} packageData - Package.json data object
 * @param {object} vercelConfig - Vercel configuration object
 * @returns {string} Project type (website or package)
 */
export function getProjectType(packageData, vercelConfig) {
	if (hasPackageScript(packageData, 'start') || getVercelName(vercelConfig)) {
		return 'website'
	}
	return 'package'
}

// ====================================
// Helpers

/**
 * Arrange and organize package.json data with proper structure and editions
 * @param {object} state - State object containing packageData, answers, and activeEditions
 * @returns {object} Arranged package.json data
 */
export function arrangePackage(state) {
	let packageData = JSON.parse(JSON.stringify(state.packageData))

	// Keywords
	packageData.keywords = Array.from(state.answers.keywords.values()).sort()

	// ---------------------------------
	// Editions

	const activeEditions = state.activeEditions

	// inject edition properties into package data
	if (state.activeEditions.length) {
		// add targets to babel, while supporting custom configuration
		packageData.babel = packageData.babel || {}
		packageData.babel.env = {}
		for (const edition of state.babelEditions) {
			packageData.babel.env[edition.directory] = edition.babel
		}

		// trim babel if empty
		if (Object.keys(packageData.babel.env).length === 0) {
			delete packageData.babel
		}

		// arrange keys of editions
		packageData.editions = activeEditions.map(function (edition) {
			const result = arrangekeys(
				edition,
				'description directory entry tags engines',
			)
			if (result.tags) result.tags = Array.from(result.tags.values())
			return result
		})
	} else {
		delete packageData.editions
	}

	// trim empty keys
	trimEmptyKeys(packageData)

	// ---------------------------------
	// Arrange

	// package keys
	packageData = arrangePackageData(packageData)

	// ---------------------------------
	// Scripts

	// scripts
	let scripts = Object.assign({}, state.userScripts, state.scripts)

	// merge in editions[].scripts
	Object.assign(
		scripts,
		...activeEditions.map((edition) => edition.scripts || {}),
	)

	// inject empty mandatory scripts if they don't exist
	// to ensure they are sorted correctly
	for (const key of mandatoryScriptsList) {
		if (!scripts[key]) scripts[key] = false
	}

	// cycle through the scripts
	// done via a list and for of loop, as we want to run on new entries
	const merge = {}
	const list = new Set(Object.keys(scripts))
	for (const key of list) {
		const value = scripts[key]
		const parts = key.split(':')
		if (parts.length >= 2) {
			// if a my: script accessible with the same name as an our: script
			// then tell the our: script to use the my: script instead
			// this is a way to accomplish custom (non alphabetical) sort orders
			// while accomplishing the ability to override
			if (parts[0] === 'my') {
				if (value) {
					const ourKey = 'our:' + parts.slice(1).join(':')
					if (!scripts[ourKey]) {
						scripts[ourKey] = `${state.answers.packageManager} run ${key}`
						list.add(ourKey)
					}
				} else {
					delete scripts[key]
				}
			}

			// mark the prefixes as empty strings if not already set
			// so that we can fill them in later once everything is sorted in the right spots
			// and note which keys need to merged into what prefixes
			else if (
				parts.length >= 3 /* don't concat down to `our` */ &&
				parts[0] === 'our'
			) {
				const prefix = parts.slice(0, -1).join(':')
				if (!scripts[prefix]) {
					scripts[prefix] = false
					merge[key] = prefix
					list.add(prefix)
				}
			}
		}
	}

	// perform the alpha sort, with my: scripts first, then our: scripts, then everything else
	const myScripts = Array.from(list)
		.filter((key) => key.startsWith('my:'))
		.sort()
	const ourScripts = Array.from(list)
		.filter((key) => key.startsWith('our:'))
		.sort()
	scripts = arrangekeys(scripts, myScripts.concat(ourScripts))

	// use new order, to merge scripts into a set, to prevent duplicates
	const sortedList = Object.keys(scripts)
	for (const key of sortedList) {
		const prefix = merge[key]
		// check if this key is one that is to be merged
		if (prefix) {
			const value = scripts[prefix] || false
			if (typeof value === 'string') {
				// ignore, keep the user override
			} else {
				if (!value) scripts[prefix] = new Set()
				scripts[prefix].add(`${state.answers.packageManager} run ${key}`)
			}
		}
	}

	// then combine them into a string once done
	for (const key of sortedList) {
		const script = scripts[key]
		if (script && script instanceof Set) {
			scripts[key] = Array.from(script).join(' && ')
		}
	}

	// if the mandatory scripts didn't have anything to merge, then prefill them
	for (const key of mandatoryScriptsList) {
		ensureScript(scripts, key)
	}

	// result
	packageData.scripts = scripts

	// ---------------------------------
	// Done

	return packageData
}

// ====================================
// Update

/**
 * Read package.json file and extract user scripts
 * @param {object} state - State object to populate with package data
 * @returns {Promise<object>} Parsed package.json data
 */
export async function readPackage(state) {
	const path = pathUtil.resolve(pwd, 'package.json')
	const special = ['start', 'test']

	// read
	let packageData = {}
	try {
		if (await isAccessible(path)) packageData = (await parse(path)) || {}
	} catch {}

	// adjust
	const userScripts = {}
	if (packageData.scripts) {
		// deploy to my:deploy
		if (
			packageData.scripts.deploy &&
			packageData.scripts.deploy !== defaultDeploy
		) {
			userScripts['my:deploy'] = packageData.scripts.deploy
			delete packageData.scripts.deploy
		}
		if (packageData.scripts['my:deploy']) {
			packageData.scripts['my:deploy'] = packageData.scripts[
				'my:deploy'
			].replace('npm run our:compile && ', '')
			packageData.scripts.deploy = defaultDeploy
		}

		// keep my:* scripts, and scripts with no parts
		Object.keys(packageData.scripts).forEach(function (key) {
			const value = packageData.scripts[key]
			if (special.includes(key)) {
				userScripts[key] = value
			} else if (key.startsWith('my:')) {
				userScripts[key] = value
			} else if (!key.includes(':')) {
				userScripts[key] = value
			}
		})
	}

	// apply
	state.packageData = packageData
	state.userScripts = userScripts

	// return
	return packageData
}

/**
 * Write package.json file to disk
 * @param {object} state - State object containing package data
 * @returns {Promise<void>} Promise that resolves when file is written
 */
export async function writePackage(state) {
	const path = pathUtil.resolve(pwd, 'package.json')

	status('writing the package.json file...')
	await write(path, JSON.stringify(arrangePackage(state), null, '  '))
	status('...wrote the package.json file')
}

/**
 * Update package data with user answers and configuration
 * @param {object} state - State object containing packageData and answers
 * @returns {Promise<void>} Promise that resolves when package data is updated
 */
export async function updatePackageData(state) {
	const packageDataLocal = state.packageData
	const { answers } = state

	// note
	status('customising package data...')

	// package data
	const packageData = Object.assign(
		{
			version: '1.0.0',
			license: 'Artistic-2.0',
			engines: {},
			dependencies: {},
			devDependencies: {},
			scripts: {},
		},
		packageDataLocal || {},
		{
			name: answers.name,
			author: answers.author,
			description: answers.description,
			repository: { type: 'git', url: answers.repoUrl },
		},
	)

	// prepare badge removals and remove badges relating to private
	const removeBadges = ['gratipay', 'daviddm', 'daviddmdev']
	if (!answers.npm) removeBadges.push('npmversion', 'npmdownloads')

	// homepage, issues
	const homepage = slugToWebsite(answers.githubSlug)
	if (homepage) packageData.homepage = homepage
	const issues = slugToIssues(answers.githubSlug)
	if (issues) packageData.bugs = { url: issues }

	// remove old fields
	delete packageData.nakeConfiguration
	delete packageData.cakeConfiguration
	delete packageData.directories
	delete packageData.preferGlobal

	// moved to vercel.json
	delete packageData.now
	delete packageData.vercel

	// remove old docpad engines convention, replaced by peer dependency
	delete packageData.engines.docpad

	// license
	if (packageData.license && packageData.license.type) {
		packageData.license = packageData.license.type
	}

	// private
	if (answers.npm) {
		delete packageData.private
	} else {
		packageData.private = true
	}

	// prepare backers
	packageData.author = fixAuthor(packageData.author)
	packageData.authors = fixAuthors(packageData.authors || [])
	if (!packageData.contributors) packageData.contributors = []
	if (!packageData.maintainers) packageData.maintainers = []
	if (!packageData.funders) packageData.funders = []
	if (!packageData.sponsors) packageData.sponsors = []
	if (!packageData.donors) packageData.donors = []

	// correct backer fields
	if (packageData.maintainers.length === 0) {
		packageData.maintainers = [packageData.author.split(', ')[0]]
	}
	packageData.maintainers = packageData.maintainers.map(fixBalupton)
	packageData.contributors = packageData.contributors.map(fixBalupton)

	// bevry org customisations
	if (isBevryOrganisation(answers.githubUsername)) {
		console.info('applying bevry customisations')

		// past donors
		packageData.donors = Fellow.add(packageData.donors, pastBevrySponsors).map(
			(fellow) => fellow.toString(),
		)

		// funding
		packageData.funding = 'https://bevry.me/fund'

		// change license
		if (packageData.license === 'MIT') packageData.license = 'Artistic-2.0'

		// badges
		packageData.badges = {
			list: [
				'githubworkflow',
				'npmversion',
				'npmdownloads',
				'---',
				'githubsponsors',
				'thanksdev',
				'liberapay',
				// doesn't support kofi
				'buymeacoffee',
				'opencollective',
				'crypto',
				'paypal',
				'---',
				'discord',
				'twitch',
			],
			config: {
				githubWorkflow: state.githubWorkflow,
				githubSponsorsUsername: 'balupton',
				thanksdevGithubUsername: answers.githubUsername,
				liberapayUsername: 'bevry',
				buymeacoffeeUsername: 'balupton',
				opencollectiveUsername: 'bevry',
				cryptoURL: 'https://bevry.me/crypto',
				paypalURL: 'https://bevry.me/paypal',
				discordServerID: '1147436445783560193',
				discordServerInvite: 'nQuXddV7VP',
				twitchUsername: 'balupton',
			},
		}
	}

	// default badges
	if (
		!packageData.badges ||
		!packageData.badges.list ||
		!packageData.badges.list.length
	) {
		packageData.badges = { list: ['npmversion', 'npmdownloads'] }
	}

	// apply badge removals
	packageData.badges.list = complement(packageData.badges.list, removeBadges)
	delete packageData.badges.gratipayUsername

	// merge with latest backers
	if (hasCredentials()) {
		console.info('fetching lastest backers...')
		const backers = await getBackers({
			githubSlug: answers.githubSlug,
			packageData,
		})
		Object.assign(packageData, renderBackers(backers, { format: 'package' }))
		console.info('...fetched lastest backers')
	}

	// note
	status('...customised package data')

	// apply
	state.packageData = packageData
}
