// builtin
import * as pathUtil from 'node:path'

// external
import { is as isBevryOrganisation } from '@bevry/github-orgs'
import { complement, has } from '@bevry/list'
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
import trimEmptyKeys from 'trim-empty-keys'

// local
import {
	defaultDeploy,
	ensureScript,
	fixBalupton,
	fixAuthor,
	fixAuthors,
} from './util.js'
import { pwd, pastBevrySponsors } from './data.js'
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

export async function isNPM() {
	const npmlock = await isAccessible(`./package-lock.json`)
	return npmlock
}

export async function isPNPM() {
	const pnpm = await isAccessible(`./pnpm-lock.yaml`)
	return pnpm
}

export async function isYARN() {
	const pnpjs = await isAccessible(`./.pnp.js`)
	const pnp = await isAccessible(`./.pnp`)
	const yarnlock = await isAccessible(`./yarn.lock`)
	const yarn = yarnlock || pnp || pnpjs
	return yarn
}

export function isGitUrl(input) {
	return /\.git$/.test(input)
}

export function getRepoUrl(input = '') {
	return getRepositoryUrlFromUrlOrGitHubSlug(input) || null
}

export function slugToWebsite(githubSlug = '') {
	return getRepositoryWebsiteUrlFromGitHubSlugOrUrl(githubSlug) || null
}

export function slugToIssues(githubSlug = '') {
	return getRepositoryIssuesUrlFromGitHubSlugOrUrl(githubSlug) || null
}

export function repoToSlug(input = '') {
	return getGitHubSlugFromUrl(input) || null
}

export function repoToUsername(input = '') {
	const githubSlug = getGitHubSlugFromUrl(input)
	return (githubSlug && githubSlug.split('/')[0]) || null
}

export function repoToProject(input = '') {
	const githubSlug = getGitHubSlugFromUrl(input)
	return (githubSlug && githubSlug.split('/')[1]) || null
}

export function getPackageName(packageData) {
	return packageData.name || null
}

export function getPackageDescription(packageData) {
	return packageData.description || null
}

export function getPackageKeywords(packageData) {
	return (packageData.keywords && packageData.keywords.join(', ')) || null
}

export function getPackageNodeEngine(packageData) {
	return (packageData.engines && packageData.engines.node) || null
}

export function getPackageNodeEngineVersion(packageData) {
	const nodeEngine = getPackageNodeEngine(packageData)
	if (nodeEngine) return nodeEngine.replace(/[^0-9]+/, '') || null
	return null
}

export function setPackageNodeEngine(packageData, nodeEngine) {
	if (!packageData.engines) packageData.engines = {}
	packageData.engines.node = nodeEngine
}

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

export function getPackageFlowtypeDependency(packageData) {
	return (
		(packageData.devDependencies &&
			Boolean(packageData.devDependencies['flow-bin'])) ||
		null
	)
}

export function hasSyntax(packageData, syntax) {
	const edition =
		packageData.editions &&
		packageData.editions.length &&
		packageData.editions[0]
	const tags = (edition && (edition.tags || edition.syntaxes)) || []
	return has(tags, syntax)
}

/** Does the source code use ESM? */
export function isSourceModule(packageData) {
	return hasSyntax(packageData, 'import')
}

/** Does the exported package use USM by default? */
export function isPackageModule(packageData) {
	return packageData.type === 'module'
}

export function getPackageRepoUrl(packageData) {
	return getRepositoryUrlFromPackageData(packageData) || null
}

export function getPackageAuthor(packageData) {
	return packageData.author || null
}

export function hasEditions(packageData) {
	return packageData.editions && Boolean(packageData.editions.length)
}

export function isES5(packageData) {
	return (
		packageData.editions &&
		packageData.editions[0] &&
		has(packageData.editions[0].tags, 'es5')
	)
}

export function getPackageScript(packageData, key) {
	return (packageData.scripts && packageData.scripts[key]) || null
}

export function hasPackageScript(packageData, key) {
	return Boolean(getPackageScript(packageData, key))
}

export function hasPackageScriptPrefix(packageData, key) {
	return Boolean(
		Object.keys(packageData.scripts || {}).find((value) =>
			value.startsWith(key),
		),
	)
}

export function hasDocumentation(packageData) {
	return hasPackageScript(packageData, 'our:meta:docs')
}

export function hasMultipleEditions(packageData) {
	if (packageData.editions) {
		return packageData.editions.length > 1
	}
	return null
}

export function isPackageJavaScript(packageData) {
	return hasSyntax(packageData, 'esnext')
}

export function isPackageTypeScript(packageData) {
	if (packageData) {
		if (/\.ts$/.test(packageData.main)) {
			return true
		}
		if (packageData.devDependencies) {
			if (packageData.devDependencies.typescript) {
				return true
			}
		}
		if (hasSyntax(packageData, 'typescript')) {
			return true
		}
	}
	return false
}

export function isPackageJSON(packageData) {
	return /\.json$/.test(packageData.main) || false
}

export function isPackageCoffee(packageData) {
	if (packageData) {
		if (/\.coffee$/.test(packageData.main)) {
			return true
		}
		if (packageData.devDependencies) {
			if (
				packageData.devDependencies['coffee-script'] ||
				packageData.devDependencies.coffeescript
			) {
				return true
			}
		}
		if (hasSyntax(packageData, 'coffeescript')) {
			return true
		}
	}
	return false
}

export function getPackageProperty(packageData, key) {
	return packageData[key]
}

export function getPackageOrganisation(packageData) {
	return repoToUsername(getGitHubSlugFromPackageData(packageData)) || null
}

export function isPackageDocPadPlugin(packageData) {
	return (
		(packageData.name && packageData.name.startsWith('docpad-plugin-')) || false
	)
}

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

export function getBasename(path) {
	// remove dirname, then remove extension
	return (
		(typeof path === 'string' &&
			path.replace(/^.+\//, '').replace(/\.[^.]+$/, '')) ||
		null
	)
}

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

// return the bin entry as a string (if single bin entry), or as an object of strings that point to the same bin entry (if multiple bin names)
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

export function getPackageBinEntry(packageData, basename = true) {
	const bin = packageData.bin
	if (bin) {
		const entry = typeof bin === 'string' ? bin : Object.values(bin)[0]
		return basename ? getBasename(entry) : entry
	}
	return null
}

export async function getPackageIndexEntry(packageData) {
	if (packageData && isPackageDocPadPlugin(packageData)) {
		return 'index'
	}
	return getBasename(packageData && packageData.main)
}

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

export async function getPackageDenoEntry(packageData) {
	return getBasename(
		(await echoExists('source/deno.ts')) || (packageData && packageData.deno),
	)
	// don't use packageData.deno
	// have them set it via package.json:boundation:denoEntry
	// as otherwise when you delete the deno entry file, to say use index entry file instead, the change won't be automatically detected
}

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

export function getProjectType(packageData, vercelConfig) {
	if (hasPackageScript(packageData, 'start') || getVercelName(vercelConfig)) {
		return 'website'
	}
	return 'package'
}

// ====================================
// Helpers

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

export async function readPackage(state) {
	const path = pathUtil.resolve(pwd, 'package.json')
	const special = ['start', 'test']

	// read
	let packageData = {}
	try {
		if (await isAccessible(path)) packageData = (await parse(path)) || {}
	} catch (err) {}

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

export async function writePackage(state) {
	const path = pathUtil.resolve(pwd, 'package.json')

	status('writing the package.json file...')
	await write(path, JSON.stringify(arrangePackage(state), null, '  '))
	status('...wrote the package.json file')
}

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
			repository: {
				type: 'git',
				url: answers.repoUrl,
			},
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
	if (packageData.maintainers.length === 0)
		packageData.maintainers = [packageData.author.split(', ')[0]]
	packageData.maintainers = packageData.maintainers.map(fixBalupton)
	packageData.contributors = packageData.contributors.map(fixBalupton)

	// bevry org customisations
	if (isBevryOrganisation(answers.githubUsername)) {
		console.log('applying bevry customisations')

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
		packageData.badges = {
			list: ['npmversion', 'npmdownloads'],
		}
	}

	// apply badge removals
	packageData.badges.list = complement(packageData.badges.list, removeBadges)
	delete packageData.badges.gratipayUsername

	// merge with latest backers
	if (hasCredentials()) {
		console.log('fetching lastest backers...')
		const backers = await getBackers({
			githubSlug: answers.githubSlug,
			packageData,
		})
		Object.assign(packageData, renderBackers(backers, { format: 'package' }))
		console.log('...fetched lastest backers')
	}

	// note
	status('...customised package data')

	// apply
	state.packageData = packageData
}
