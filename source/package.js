/* eslint no-console:0 */
'use strict'

// Prepare
const mandatoryScriptsList = 'our:setup our:compile our:meta our:verify our:deploy our:release'.split(' ')
const bevryOrganisationsList = 'balupton bevry bevry-trading docpad browserstate webwrite chainyjs interconnectapp'.split(' ')

// Local
const { status } = require('./log')
const { repoToWebsite, repoToOrganisation } = require('./string')
const { exists, write, read } = require('./fs')

// External
const arrangekeys = require('arrangekeys')
const pathUtil = require('path')

// ====================================
// Fetchers

function getPackageName (packageData) {
	return (packageData && packageData.name) || null
}

function getPackageDescription (packageData) {
	return (packageData && packageData.description) || null
}

function getPackageKeywords (packageData) {
	return (packageData && packageData.keywords && packageData.keywords.join(', ')) || null
}

function getPackageNodeEngineVersion (packageData) {
	return (packageData && packageData.engines && packageData.engines.node && packageData.engines.node.replace(/[^0-9]+/, '')) || null
}

function getPackageDocumentationDependency (packageData) {
	if (packageData && packageData.devDependencies) {
		if (packageData.devDependencies.documentation || packageData.devDependencies.yuidocjs || packageData.devDependencies.biscotto) {
			return true
		}
	}
	return false
}

function getPackageFlowtypeDependency (packageData) {
	return (packageData && packageData.devDependencies && Boolean(packageData.devDependencies['flow-bin'])) || null
}

function getPackageModules (packageData) {
	const edition = (packageData && packageData.editions && packageData.editions[0])
	if (edition == null || edition.syntaxes == null) return null
	return edition.syntaxes.has('import')
}

function getPackageRepoUrl (packageData) {
	return (packageData && packageData.repository && packageData.repository.url) || null
}

function getPackageAuthor (packageData) {
	return (packageData && packageData.author) || null
}

function getNowName (packageData) {
	return (packageData && packageData.now && packageData.now.name) || null
}

function getNowAliases (packageData) {
	return (packageData && packageData.now && Array.isArray(packageData.now.alias) && packageData.now.alias.join(' ')) || null
}

function hasMultipleEditions (packageData) {
	if (packageData && packageData.editions) {
		return packageData.editions.length > 1
	}
	return null
}

function isPackageJavaScript (packageData) {
	return (packageData && packageData.editions && packageData.editions[0] && packageData.editions[0].syntaxes && packageData.editions[0].syntaxes.has('esnext')) || false
}

function isPackageJSON (packageData) {
	return (packageData && (/\.json$/).test(packageData.main)) || false
}

function isPackageCoffee (packageData) {
	if (packageData) {
		if ((/\.coffee$/).test(packageData.main)) {
			return true
		}
		if (packageData.devDependencies) {
			if (packageData.devDependencies['coffee-script'] || packageData.devDependencies.coffeescript) {
				return true
			}
		}
		if (packageData.editions && packageData.editions[0].syntaxes.has('coffeescript')) {
			return true
		}
	}
	return false
}

function getPackageProperty (packageData, key) {
	return packageData && packageData[key]
}

function getPackageOrganisation (packageData) {
	return repoToOrganisation(getPackageRepoUrl(packageData) || '') || null
}

function isPackageDocPadPlugin (packageData) {
	return packageData && packageData.name && packageData.name.startsWith('docpad-plugin-')
}

function isPackageWebsite (packageData) {
	return (packageData && packageData.scripts && packageData.scripts.start) || false
}

function getPackageDependencies (packageData) {
	if (packageData) {
		return [].concat(Object.keys(packageData.dependencies || {}), Object.keys(packageData.devDependencies || {}))
	}
	return []
}

function isPackageDocPadWebsite (packageData) {
	return getPackageDependencies(packageData).has('docpad')
}

function getPackageMainEntry (packageData) {
	if (packageData) {
		if (isPackageDocPadPlugin(packageData)) {
			return packageData.name.replace(/^docpad-plugin-/, '') + '.plugin'
		}
		else {
			return (packageData.main && packageData.main
				.replace(/^.+\//, '') /* remove dirname */
				.replace(/\.[^.]+$/, '') /* remove extension */
			) || null
		}
	}
	return null
}

function getPackageTestEntry (packageData) {
	if (packageData) {
		if (isPackageDocPadPlugin(packageData)) {
			return packageData.name.replace(/^docpad-plugin-/, '') + '.test'
		}
		else if (packageData.scripts && packageData.scripts.test) {
			const result = packageData.scripts.test.match(/^node(?: --[a-zA-Z0-9_]+)* (?:[^/]+\/)*([^.]+)\.js/) /* fetches filename without ext */
			return (result && result[1]) || null
		}
	}
	return null
}

// ====================================
// Helpers

function arrangePackage (state) {
	state.packageData.editions = state.editions
	const packageData = JSON.parse(JSON.stringify(state.packageData))

	// inject edition properties into package data
	if (state.editions && state.editions.length) {
		// add targets to babel
		packageData.babel = {
			env: {}
		}
		for (const edition of state.editions) {
			if (!edition.targets) continue
			packageData.babel.env[edition.directory] = ({
				presets: [
					[
						'env',
						{
							targets: edition.targets
						}
					]
				]
			})
		}

		// trim babel if empty
		if (Object.keys(packageData.babel.env).length === 0) {
			delete packageData.babel
		}

		// arrange keys of editions
		packageData.editions = packageData.editions.map((edition) => arrangekeys(edition, 'description directory entry syntaxes engines'))
	}

	// package keys
	const arrangedPackage = arrangekeys(packageData, 'title name version private description homepage license keywords badges author sponsors maintainers contributors bugs repository engines editions bin preferGlobal main browser dependencies devDependencies optionalDependencies peerDependencies scripts babel')

	// scripts
	let scripts = Object.assign({}, state.userScripts, state.scripts)

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
						scripts[ourKey] = `npm run ${key}`
						list.add(ourKey)
					}
				}
				else {
					delete scripts[key]
				}
			}

			// mark the prefixes as empty strings if not already set
			// so that we can fill them in later once everything is sorted in the right spots
			// and note which keys need to merged into what prefixes
			else if (parts.length >= 3 /* don't concat down to `our` */ && parts[0] === 'our') {
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
	const myScripts = Array.from(list).filter((key) => key.startsWith('my:')).sort()
	const ourScripts = Array.from(list).filter((key) => key.startsWith('our:')).sort()
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
			}
			else {
				if (!value) scripts[prefix] = new Set()
				scripts[prefix].add(`npm run ${key}`)
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
		if (!scripts[key]) scripts[key] = 'echo no need for this project'
	}

	// result
	arrangedPackage.scripts = scripts
	return arrangedPackage
}


// ====================================
// Update

async function readPackage (state) {
	const { cwd } = state
	const path = pathUtil.resolve(cwd, 'package.json')

	status('reading the package.json file...')
	try {
		if (await exists(path)) {
			const packageDataLocal = JSON.parse(await read(path))
			status('...read the package.json file')
			state.packageData = packageDataLocal

			// user scripts
			const userScripts = {}
			if (packageDataLocal && packageDataLocal.scripts) {
				// start
				if (packageDataLocal.scripts.start) {
					userScripts.start = packageDataLocal.scripts.start
				}

				// deploy to my:deploy
				if (packageDataLocal.scripts.deploy) {
					userScripts['my:deploy'] = packageDataLocal.scripts.deploy
				}

				// keep my:* scripts
				Object.keys(packageDataLocal.scripts).forEach(function (key) {
					if (key.startsWith('my:')) {
						const value = packageDataLocal.scripts[key]
						userScripts[key] = value
					}
				})
			}
			state.userScripts = userScripts

			// return
			return packageDataLocal
		}
	}
	catch (err) {
		status('...skipped the package.json file')
		return null
	}
}

async function writePackage (state) {
	const { cwd } = state
	const path = pathUtil.resolve(cwd, 'package.json')

	status('writing the package.json file...')
	await write(path,
		JSON.stringify(arrangePackage(state), null, '  ')
	)
	status('...wrote the package.json file')
}

async function updatePackageData (state) {
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
			devDependencies: {}
		},
		packageDataLocal || {},
		{
			name: answers.name,
			description: answers.description,
			keywords: answers.keywords.split(/,\s*/),
			homepage: repoToWebsite(answers.repoUrl),
			bugs: {
				url: repoToWebsite(answers.repoUrl) + '/issues'
			},
			repository: {
				type: 'git',
				url: repoToWebsite(answers.repoUrl) + '.git'
			},
			scripts: {}
		}
	)

	// engines
	if (answers.website) {
		packageData.engines.node = `${answers.desiredNodeVersion}`
	}
	else {
		packageData.engines.node = `>=${answers.minimumSupportNodeVersion}`
	}

	// license
	if (packageData.license && packageData.license.type) {
		packageData.license = packageData.license.type
	}

	// private
	if (answers.npm) {
		delete packageData.private
	}
	else {
		packageData.private = true
	}

	// add maintainer if there aren't any
	if (!packageData.maintainers || packageData.maintainers.length === 0) {
		if (packageData.contributors.length === 1) {
			packageData.maintainers = [].concat(packageData.contributors)
		}
		else {
			packageData.maintainers = [
				packageData.author.split(/, +/).sort().slice(-1)[0].replace(/^[\d-+]+ +/, '')
			]
		}
	}

	// remove old fields
	delete packageData.nakeConfiguration
	delete packageData.cakeConfiguration
	delete packageData.directories

	// badges
	const removeBadges = ['gratipay']
	if (bevryOrganisationsList.has(answers.organisation)) {
		packageData.badges = {
			list: [
				'travisci',
				'npmversion',
				'npmdownloads',
				'daviddm',
				'daviddmdev',
				'---',
				'patreon',
				'opencollective',
				'flattr',
				'paypal',
				'bitcoin',
				'wishlist'
			],
			config: {
				patreonUsername: 'bevry',
				opencollectiveUsername: 'bevry',
				flattrUsername: 'balupton',
				paypalURL: 'https://bevry.me/paypal',
				bitcoinURL: 'https://bevry.me/bitcoin',
				wishlistURL: 'https://bevry.me/wishlist'
			}
		}
	}
	else if (!packageData.badges) {
		packageData.badges = {
			list: [
				'travisci',
				'npmversion',
				'npmdownloads',
				'daviddm',
				'daviddmdev'
			]
		}
	}
	if (packageData.private) {
		removeBadges.push(
			'npmversion',
			'npmdownloads',
			'daviddm',
			'daviddmdev'
		)
	}
	// apply removals
	packageData.badges.list = packageData.badges.list.without(removeBadges)
	delete packageData.badges.gratipayUsername

	// note
	status('...customised package data')

	// apply
	state.packageData = packageData
}

module.exports = {
	readPackage,
	writePackage,
	getNowAliases,
	getNowName,
	getPackageProperty,
	getPackageAuthor,
	getPackageDependencies,
	getPackageDescription,
	getPackageDocumentationDependency,
	getPackageFlowtypeDependency,
	getPackageKeywords,
	getPackageMainEntry,
	getPackageModules,
	getPackageName,
	getPackageNodeEngineVersion,
	getPackageOrganisation,
	getPackageRepoUrl,
	getPackageTestEntry,
	hasMultipleEditions,
	isPackageCoffee,
	isPackageDocPadPlugin,
	isPackageDocPadWebsite,
	isPackageJavaScript,
	isPackageJSON,
	isPackageWebsite,
	updatePackageData
}
