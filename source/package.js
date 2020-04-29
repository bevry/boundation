/* eslint no-console:0 */
'use strict'

// Prepare
const mandatoryScriptsList = 'our:setup our:compile our:meta our:verify our:deploy our:release test'.split(
	' '
)

// Local
const { status } = require('./log')
const {
	has,
	repoToWebsite,
	repoToOrganisation,
	without,
	ensureScript,
	isBevryOrganisation,
} = require('./util')
const { exists, write, parse } = require('./fs')
const { getNowName } = require('./website')

// External
const arrangekeys = require('arrangekeys').default
const pathUtil = require('path')
const typeChecker = require('typechecker')

// ====================================
// Fetchers

async function isNPM() {
	const npmlock = await exists(`./package-lock.json`)
	const npm = npmlock
	return npm
}

async function isYARN() {
	const pnpjs = await exists(`./.pnp.js`)
	const pnp = await exists(`./.pnp`)
	const yarnlock = await exists(`./yarn.lock`)
	const yarn = yarnlock || pnp || pnpjs
	const npm = await isNPM()
	return yarn && !npm
}

function getPackageName(packageData) {
	return packageData.name || null
}

function getPackageDescription(packageData) {
	return packageData.description || null
}

function getPackageKeywords(packageData) {
	return (packageData.keywords && packageData.keywords.join(', ')) || null
}

function getPackageNodeEngineVersion(packageData) {
	return (
		(packageData.engines &&
			packageData.engines.node &&
			packageData.engines.node.replace(/[^0-9]+/, '')) ||
		null
	)
}

function getPackageDocumentationDependency(packageData) {
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

function getPackageFlowtypeDependency(packageData) {
	return (
		(packageData.devDependencies &&
			Boolean(packageData.devDependencies['flow-bin'])) ||
		null
	)
}

function hasSyntax(packageData, syntax) {
	const edition =
		packageData.editions &&
		packageData.editions.length &&
		packageData.editions[0]
	const tags = (edition && (edition.tags || edition.syntaxes)) || []
	return has(tags, syntax)
}

function isSourceModule(packageData) {
	return hasSyntax(packageData, 'import')
}

function isPackageModule(packageData) {
	return packageData.type === 'module'
}

function getPackageRepoUrl(packageData) {
	return (packageData.repository && packageData.repository.url) || null
}

function getPackageAuthor(packageData) {
	return packageData.author || null
}

function hasEditions(packageData) {
	return packageData.editions && Boolean(packageData.editions.length)
}

function isES5(packageData) {
	return (
		packageData.editions &&
		packageData.editions[0] &&
		has(packageData.editions[0].tags, 'es5')
	)
}

function getPackageScript(packageData, key) {
	return (packageData.scripts && packageData.scripts[key]) || null
}

function hasPackageScript(packageData, key) {
	return Boolean(getPackageScript(packageData, key))
}

function hasPackageScriptPrefix(packageData, key) {
	return Boolean(
		Object.keys(packageData.scripts || {}).find((value) =>
			value.startsWith(key)
		)
	)
}

function hasDocumentation(packageData) {
	return hasPackageScript(packageData, 'our:meta:docs')
}

function hasMultipleEditions(packageData) {
	if (packageData.editions) {
		return packageData.editions.length > 1
	}
	return null
}

function isPackageJavaScript(packageData) {
	return hasSyntax(packageData, 'esnext')
}

function isPackageTypeScript(packageData) {
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

function isPackageJSON(packageData) {
	return /\.json$/.test(packageData.main) || false
}

function isPackageCoffee(packageData) {
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

function getPackageProperty(packageData, key) {
	return packageData[key]
}

function getPackageOrganisation(packageData) {
	return repoToOrganisation(getPackageRepoUrl(packageData) || '') || null
}

function isPackageDocPadPlugin(packageData) {
	return (
		(packageData.name && packageData.name.startsWith('docpad-plugin-')) || false
	)
}

function hasPackageDependency(packageData, key) {
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

function getBasename(path) {
	// remove dirname, then remove extension
	return (
		(typeof path === 'string' &&
			path.replace(/^.+\//, '').replace(/\.[^.]+$/, '')) ||
		null
	)
}

function getPackageMainEntry(packageData) {
	if (packageData) {
		if (isPackageDocPadPlugin(packageData)) {
			return 'index'
		} else {
			return getBasename(packageData.main)
		}
	}
	return null
}

function getPackageTestEntry(packageData) {
	if (packageData) {
		if (isPackageDocPadPlugin(packageData)) {
			return 'test'
		} else if (packageData.scripts && packageData.scripts.test) {
			const result = packageData.scripts.test.match(
				/^node(?: --[a-zA-Z0-9_]+)* (?:[^/]+\/)*([^.]+)\.js/
			) /* fetches filename without ext */
			return (result && result[1]) || null
		}
	}
	return null
}

function getPackageBinEntry(packageData) {
	const bin = packageData.bin
	if (bin) {
		const entry = typeof bin === 'string' ? bin : Object.values(bin)[0]
		return getBasename(entry)
	}
	return null
}

function getPackageBinExecutable(packageData) {
	const bin = packageData.bin
	if (bin) {
		if (typeof bin === 'string') return null
		return Object.keys(bin).join(', ')
	}
	return null
}

function getPackageBrowserEntry(packageData) {
	return getBasename(packageData.module) || null
}

function getWebsiteType(packageData, nowData) {
	if (hasPackageDependency(packageData, 'next')) {
		return '@now/next'
	}
	if (hasPackageDependency(packageData, 'docpad')) {
		return 'docpad on @now/static'
	}
	if (getNowName(nowData)) {
		if (
			nowData.builds &&
			nowData.builds.length &&
			nowData.builds[0].use === '@now/static'
		) {
			return '@now/static'
		}
		return 'now'
	}
	if (hasPackageDependency(packageData, 'surge')) {
		return 'surge'
	}
	return 'custom'
}

function getProjectType(packageData, nowData) {
	if (hasPackageScript(packageData, 'start') || getNowName(nowData)) {
		return 'website'
	}
	return 'package'
}

// ====================================
// Helpers

function arrangePackage(state) {
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
				'description directory entry tags engines'
			)
			if (result.tags) result.tags = Array.from(result.tags.values())
			return result
		})
	} else {
		delete packageData.editions
	}

	// trim empty keys
	for (const key in packageData) {
		if (packageData.hasOwnProperty(key)) {
			const value = packageData[key]
			if (typeChecker.isArray(value) && typeChecker.isEmptyArray(value)) {
				console.log(`trim: array: package.json:${key}`)
				delete packageData[key]
			} else if (
				typeChecker.isPlainObject(value) &&
				typeChecker.isEmptyPlainObject(value)
			) {
				console.log(`trim: empty: package.json:${key}`)
				delete packageData[key]
			} else if (value == null || value === '') {
				console.log(`trim: null|'': package.json:${key}`)
				delete packageData[key]
			}
		}
	}

	// ---------------------------------
	// Badges

	// set travisTLD if it is com
	// we don't set it explicity to org
	// so that when the official migration happens, there will be no manual changes
	if (
		packageData.badges.list.includes('travisci') &&
		state.travisTLD === 'com'
	) {
		packageData.badges.config.travisTLD = state.travisTLD
	}

	// ---------------------------------
	// Arrange

	// package keys
	packageData = arrangekeys(
		packageData,
		'title name version private description homepage license keywords badges funding author sponsors maintainers contributors bugs repository engines editions bin types type main browser module jspm dependencies optionalDependencies devDependencies peerDependencies scripts now eslintConfig prettier babel'
	)

	// ---------------------------------
	// Scripts

	// scripts
	let scripts = Object.assign({}, state.userScripts, state.scripts)

	// merge in editions[].scripts
	Object.assign(
		scripts,
		...activeEditions.map((edition) => edition.scripts || {})
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
			// if a my: script exists with the same name as an our: script
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

async function readPackage(state) {
	const { cwd } = state
	const path = pathUtil.resolve(cwd, 'package.json')
	const special = ['start', 'test']

	// read
	let packageData = {}
	try {
		if (await exists(path)) packageData = (await parse(path)) || {}
	} catch (err) {}

	// adjust
	const userScripts = {}
	if (packageData.scripts) {
		// deploy to my:deploy
		if (packageData.scripts.deploy) {
			userScripts['my:deploy'] = packageData.scripts.deploy
			delete packageData.scripts.deploy
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

async function writePackage(state) {
	const { cwd } = state
	const path = pathUtil.resolve(cwd, 'package.json')

	status('writing the package.json file...')
	await write(path, JSON.stringify(arrangePackage(state), null, '  '))
	status('...wrote the package.json file')
}

async function updatePackageData(state) {
	const packageDataLocal = state.packageData
	const { answers } = state

	// note
	status('customising package data...')

	// package data
	const packageData = Object.assign(
		{
			version: '1.0.0',
			license: 'MIT',
			author: answers.author,
			engines: {},
			dependencies: {},
			devDependencies: {},
		},
		packageDataLocal || {},
		{
			name: answers.name,
			description: answers.description,
			homepage: repoToWebsite(answers.repoUrl),
			bugs: {
				url: repoToWebsite(answers.repoUrl) + '/issues',
			},
			repository: {
				type: 'git',
				url: repoToWebsite(answers.repoUrl) + '.git',
			},
			scripts: {},
		}
	)

	// engines
	if (answers.website) {
		packageData.engines.node = `>=${answers.desiredNodeVersion}`
	} else {
		packageData.engines.node = `>=${answers.minimumSupportNodeVersion}`
	}

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

	// prepare contributors
	if (!packageData.contributors) {
		packageData.contributors = []
	}

	// add maintainer if there aren't any
	if (!packageData.maintainers || packageData.maintainers.length === 0) {
		if (packageData.contributors.length === 1) {
			packageData.maintainers = [].concat(packageData.contributors)
		} else {
			packageData.maintainers = [
				packageData.author
					.split(/, +/)
					.sort()
					.slice(-1)[0]
					.replace(/^[\d-+]+ +/, ''),
			]
		}
	}

	// remove old fields
	delete packageData.nakeConfiguration
	delete packageData.cakeConfiguration
	delete packageData.directories
	delete packageData.now
	delete packageData.preferGlobal

	// badges
	const removeBadges = ['gratipay']
	if (isBevryOrganisation(answers.organisation)) {
		packageData.badges = {
			list: [
				'travisci',
				'npmversion',
				'npmdownloads',
				'daviddm',
				'daviddmdev',
				'---',
				'githubsponsors',
				'patreon',
				'flattr',
				'liberapay',
				'buymeacoffee',
				'opencollective',
				'crypto',
				'paypal',
				'wishlist',
			],
			config: {
				githubSponsorsUsername: 'balupton',
				buymeacoffeeUsername: 'balupton',
				cryptoURL: 'https://bevry.me/crypto',
				flattrUsername: 'balupton',
				liberapayUsername: 'bevry',
				opencollectiveUsername: 'bevry',
				patreonUsername: 'bevry',
				paypalURL: 'https://bevry.me/paypal',
				wishlistURL: 'https://bevry.me/wishlist',
			},
		}
		packageData.funding = 'https://bevry.me/fund'
	}

	// default badges
	if (
		!packageData.badges ||
		!packageData.badges.list ||
		!packageData.badges.list.length
	) {
		packageData.badges = {
			list: ['travisci', 'npmversion', 'npmdownloads', 'daviddm', 'daviddmdev'],
		}
	}

	// remove badges relating to private
	if (!answers.npm) {
		removeBadges.push('npmversion', 'npmdownloads', 'daviddm', 'daviddmdev')
	}

	// apply badge removals
	packageData.badges.list = without(packageData.badges.list, removeBadges)
	delete packageData.badges.gratipayUsername

	// note
	status('...customised package data')

	// apply
	state.packageData = packageData
}

module.exports = {
	getPackageAuthor,
	getPackageBinEntry,
	getPackageBinExecutable,
	getPackageBrowserEntry,
	getPackageDescription,
	getPackageDocumentationDependency,
	getPackageFlowtypeDependency,
	getPackageKeywords,
	getPackageMainEntry,
	getPackageName,
	getPackageNodeEngineVersion,
	getPackageOrganisation,
	getPackageProperty,
	getPackageRepoUrl,
	getPackageScript,
	getPackageTestEntry,
	getProjectType,
	getWebsiteType,
	hasDocumentation,
	hasEditions,
	hasMultipleEditions,
	hasPackageDependency,
	hasPackageScript,
	isES5,
	isNPM,
	isPackageCoffee,
	isPackageDocPadPlugin,
	isPackageJavaScript,
	isPackageJSON,
	isPackageModule,
	isPackageTypeScript,
	isSourceModule,
	isYARN,
	readPackage,
	updatePackageData,
	writePackage,
}
