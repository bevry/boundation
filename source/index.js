/* eslint no-sync:0, camelcase:0, no-console:0 */
'use strict'

/**
 * @param {Error} error
 * @returns {string}
 */
function stackOrMessage (error) {
	return error.stack ? `\n${error.stack}` : error.toString()
}

/**
 * @param {Error} reason
 * @returns {void}
*/
function unhandledRejection (reason) {
	console.error(`\nA promise FAILED with: ${stackOrMessage(reason)}`)
	process.exit(-1)
}
process.on('unhandledRejection', unhandledRejection)


const inquirer = require('inquirer')
const fsUtil = require('fs')
const pathUtil = require('path')
const fetch = require('node-fetch')
const arrangekeys = require('arrangekeys')
const yaml = require('js-yaml')
const urlUtil = require('url')
const safeps = require('safeps')
const { semver } = require('./util')
const cwd = process.cwd()

const NO_NEED_SCRIPT = 'echo no need for this project'
const state = {}
const nodeVersions = [
	'0.8',
	'0.10',
	'0.12',
	'4',
	'6',
	'8',
	'10'
]

// curl flags:
// -L will follow redirects
// -s is silent mode, so will only return the result
// -S will show the error if something went wrong
// -f will not output errors as content
// https://github.com/bevry/boundation/issues/15
const CURL_FLAGS = '-fsSL'

function trim (input) {
	return input.trim()
}
function slugit (input) {
	return (input && input !== 'undefined' && input.replace(/[^a-zA-Z0-9.-]+/g, '')) || ''
}
function isSpecified (input) {
	return slugit(input).length !== 0
}
function isNumber (input) {
	return (/^[0-9.]+$/).test(input)
}
function isGitUrl (input) {
	return (/\.git$/).test(input)
}
function repoToWebsite (input = '') {
	return input.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/')
}

/*
function otherwise (input, value) {
	return input == null ? value : input
}
async function getRemotePackage () {
	const response = await fetch('https://raw.githubusercontent.com/bevry/base/master/package.json')
	const data = await response.json()
	return data
}
function getOrganisationFromGithubUrl (url) {
	if ( !url )  return null
	const organisation = url.replace(/^.+github.com\/([^/]+).+$/, '$1')
	if (url !== organisation) {
		return organisation
	}
	else {
		return null
	}
}
*/

const util = {
	exists (file) {
		file = pathUtil.resolve(cwd, file)
		return new Promise(function (resolve) {
			fsUtil.exists(file, function (exists) {
				resolve(exists)
			})
		})
	},

	unlink (file) {
		file = pathUtil.resolve(cwd, file)
		return new Promise(function (resolve, reject) {
			fsUtil.unlink(file, function (error) {
				if (error) {
					if (error.message.indexOf('ENOENT') !== -1) return resolve()
					return reject(error)
				}
				return resolve()
			})
		})
	},

	read (file) {
		file = pathUtil.resolve(cwd, file)
		return new Promise(function (resolve, reject) {
			fsUtil.readFile(file, function (error, data) {
				if (error) return reject(error)
				return resolve(data)
			})
		})
	},

	rename (source, target) {
		source = pathUtil.resolve(cwd, source)
		target = pathUtil.resolve(cwd, target)
		return new Promise(function (resolve, reject) {
			fsUtil.rename(source, target, function (error) {
				if (error) return reject(error)
				return resolve()
			})
		})
	},

	write (file, data) {
		file = pathUtil.resolve(cwd, file)
		return new Promise(function (resolve, reject) {
			fsUtil.writeFile(file, data, function (error) {
				if (error) return reject(error)
				return resolve()
			})
		})
	},

	spawn (command, opts = {}) {
		opts.cwd = opts.cwd || cwd
		opts.stdio = opts.stdio || 'inherit'
		return new Promise(function (resolve, reject) {
			safeps.spawn(command, opts, function (err, stdout) {
				if (err) return reject(err)
				return resolve(stdout)
			})
		})
	},

	exec (command, opts = {}) {
		opts.cwd = opts.cwd || cwd
		return new Promise(function (resolve, reject) {
			safeps.exec(command, opts, function (err, stdout) {
				if (err) return reject(err)
				return resolve(stdout)
			})
		})
	}

}

async function download (opts) {
	try {
		if (typeof opts === 'string') opts = { url: opts }
		const response = await fetch(opts.url, {})
		let data = await response.text()
		const file = opts.file || pathUtil.basename(urlUtil.parse(opts.url).pathname)
		const exists = await util.exists(file)
		if (exists) {
			if (opts.overwrite === false) {
				return Promise.resolve()
			}
			const localData = await util.read(file).toString()
			const lines = localData.split('\n')
			const customIndex = lines.findIndex((line) => (/^# CUSTOM/i).test(line))
			if (customIndex !== -1) {
				data += lines.slice(customIndex).join('\n')
			}
		}
		return util.write(file, data)
	}
	catch (err) {
		return Promise.reject(
			new Error(`Download of ${opts.url} FAILED due to: ${stackOrMessage(err)}`)
		)
	}
}

async function getGitOriginUrl () {
	if (state.gitOriginUrl) return state.gitOriginUrl
	try {
		const stdout = await util.exec('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] })
		state.gitOriginUrl = (stdout && stdout.toString().trim()) || null
		return state.gitOriginUrl
	}
	catch (error) {
		return null
	}
}

async function getGitUserName () {
	if (state.gitUserName) return state.gitUserName
	try {
		const stdout = await util.exec('git config --global user.name', { stdio: ['ignore', 'pipe', 'ignore'] })
		state.gitUserName = (stdout && stdout.toString().trim()) || null
		return state.gitUserName
	}
	catch (error) {
		return null
	}
}

async function getGitUserEmail () {
	if (state.gitUserEmail) return state.gitUserEmail
	try {
		const stdout = await util.exec('git config --global user.email', { stdio: ['ignore', 'pipe', 'ignore'] })
		state.gitUserEmail = (stdout && stdout.toString().trim()) || null
		return state.gitUserEmail
	}
	catch (error) {
		return null
	}
}

async function getMinimumNodeLTSVersion () {
	const response = await fetch('https://raw.githubusercontent.com/nodejs/Release/master/schedule.json')
	const json = await response.json()
	const now = (new Date()).getTime()
	const lts = Object.keys(json).find(function (version) {
		const meta = json[version]
		if (meta.lts) {
			const end = (new Date(meta.lts)).getTime()
			if (end <= now) {
				return true
			}
		}
		return false
	}).replace('v', '')
	return lts
}

async function getMaximumNodeLTSVersion () {
	const response = await fetch('https://raw.githubusercontent.com/nodejs/Release/master/schedule.json')
	const json = await response.json()
	const now = (new Date()).getTime()
	const lts = Object.keys(json).reverse().find(function (version) {
		const meta = json[version]
		if (meta.lts) {
			const lts = (new Date(meta.lts)).getTime()
			if (lts <= now) {
				return true
			}
		}
		return false
	}).replace('v', '')
	return lts
}

function getPackage () {
	if (state.package != null) return state.package
	try {
		state.package = require(pathUtil.join(process.cwd(), 'package.json'))
	}
	catch (err) {
		state.package = false
	}
	return state.package
}

function getPackageName (packageData = getPackage()) {
	return (packageData && packageData.name) || null
}

function getPackageDescription (packageData = getPackage()) {
	return (packageData && packageData.description) || null
}

function getPackageKeywords (packageData = getPackage()) {
	return (packageData && packageData.keywords && packageData.keywords.join(', ')) || null
}

function getPackageNodeEngineVersion (packageData = getPackage()) {
	return (packageData && packageData.engines && packageData.engines.node && packageData.engines.node.replace(/[^0-9]+/, '')) || null
}

function getPackageDocumentationDependency (packageData = getPackage()) {
	if (packageData && packageData.devDependencies) {
		if (packageData.devDependencies.documentation || packageData.devDependencies.yuidocjs || packageData.devDependencies.biscotto) {
			return true
		}
	}
	return false
}

function getPackageFlowtypeDependency (packageData = getPackage()) {
	return (packageData && packageData.devDependencies && Boolean(packageData.devDependencies['flow-bin'])) || null
}

function getPackageModules (packageData = getPackage()) {
	const edition = (packageData && packageData.editions && packageData.editions[0])
	if (edition == null || edition.syntaxes == null) return null
	return edition.syntaxes.indexOf('import') !== -1
}

function getPackageRepoUrl (packageData = getPackage()) {
	return (packageData && packageData.repository && packageData.repository.url) || null
}

function getPackageAuthor (packageData = getPackage()) {
	return (packageData && packageData.author) || null
}

function hasMultipleEditions (packageData = getPackage()) {
	if (packageData && packageData.editions) {
		return packageData.editions.length > 1
	}
	return null
}

function getPackageType (packageData = getPackage()) {
	if (packageData) {
		if (packageData.scripts && packageData.scripts.start) {
			if (packageData.main) {
				return 'coded-website'
			}
			else {
				return 'website'
			}
		}
		else {
			return 'code'
		}
	}
}

function isPackageJSON (packageData = getPackage()) {
	return (packageData && (/\.json$/).test(packageData.main)) || false
}

function isPackageCoffee (packageData = getPackage()) {
	if (packageData) {
		if ((/\.coffee$/).test(packageData.main)) {
			return true
		}
		if (packageData.devDependencies) {
			if (packageData.devDependencies['coffee-script'] || packageData.devDependencies.coffeescript) {
				return true
			}
		}
		if (packageData.editions && packageData.editions[0].syntaxes.indexOf('coffeescript') !== -1) {
			return true
		}
	}
	return false
}

function isPackageDocPadPlugin (packageData = getPackage()) {
	return packageData && packageData.name.indexOf('docpad-plugin-') === 0
}

function getPackageMainEntry (packageData = getPackage()) {
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

function getPackageTestEntry (packageData = getPackage()) {
	if (packageData) {
		if (isPackageDocPadPlugin(packageData)) {
			return packageData.name.replace(/^docpad-plugin-/, '') + '.test'
		}
		else {
			const result = packageData.scripts
				&& packageData.scripts.test
				&& packageData.scripts.test
				&& packageData.scripts.test.match(/^node(?: --[a-zA-Z0-9_]+)* (?:[^/]+\/)*([^.]+)\.js/) /* fetches filename without ext */
			return (result && result[1]) || null
		}
	}
	return null
}

function mergeScript (packageData, name, match) {
	packageData.scripts[name] = Object.keys(packageData.scripts)
		.filter((key) => match.test(key) && packageData.scripts[key])
		.map((key) => `npm run ${key}`)
		.join(' && ') || NO_NEED_SCRIPT
}

function arrangePackage (packageData) {
	return arrangekeys(packageData, 'title name version private description homepage license keywords badges author sponsors maintainers contributors bugs repository engines editions bin preferGlobal main browser dependencies devDependencies optionalDependencies peerDependencies scripts')
}

const defaults = {
	npmEmail: process.env.NPM_EMAIL,
	npmAuthToken: process.env.NPM_AUTHTOKEN,
	npmUsername: process.env.NPM_USERNAME,
	npmPassword: process.env.NPM_PASSWORD,
	travisEmail: process.env.TRAVIS_NOTIFICATION_EMAIL,
	slackSubdomain: process.env.SLACK_SUBDOMAIN,
	slackToken: process.env.SLACK_TRAVIS_TOKEN,
	surgeLogin: process.env.SURGE_LOGIN,
	surgeToken: process.env.SURGE_TOKEN
}

async function getQuestions () {
	return [
		{
			name: 'name',
			message: 'What will be the package name?',
			default: getPackageName(),
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'description',
			message: 'and the package description?',
			default: getPackageDescription(),
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'keywords',
			message: 'What are some keywords to describe the project?',
			default: getPackageKeywords(),
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'repoUrl',
			message: 'What will the git repository URL be?',
			default: await getGitOriginUrl() || getPackageRepoUrl(),
			validate: isGitUrl,
			filter: trim
		},
		{
			name: 'type',
			type: 'list',
			choices: ['code', 'website', 'coded-website'],
			message: 'What type of project is this?',
			default: getPackageType()
		},
		{
			name: 'deployWithSurge',
			type: 'confirm',
			message: 'Use surge to deploy the website?',
			when ({ type }) {
				return type === 'website' || type === 'coded-website'
			}
		},
		{
			name: 'docpadPlugin',
			type: 'confirm',
			message: 'Will this be a DocPad plugin?',
			default: isPackageDocPadPlugin() || false,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'publish',
			type: 'confirm',
			message: 'Will it be published to npm?',
			default: getPackage().private != null ? !getPackage().private : null,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'browser',
			type: 'confirm',
			message: 'Will it be used on the client-side inside web browsers?',
			default: Boolean(getPackage().browser),
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'language',
			type: 'list',
			choices: ['esnext', 'javascript', 'coffeescript', 'json'],
			message: 'What language will it use?',
			default: (isPackageJSON() && 'json') || (isPackageCoffee() && 'coffeescript') || 'esnext',
			when ({ type }) {
				return type !== 'website'
			}
		},
		{
			name: 'mainEntry',
			message: 'What is the main entry filename (without extension)?',
			default: getPackageMainEntry() || 'index',
			validate: isSpecified,
			when ({ type }) {
				return type !== 'website'
			}
		},
		{
			name: 'testEntry',
			message: 'What is the test entry filename (without extension)?',
			default: getPackageTestEntry() || 'test',
			validate: isSpecified,
			when ({ type }) {
				return type !== 'website'
			}
		},
		{
			name: 'desiredNodeVersion',
			message: 'What is the desired node version?',
			default: await getMaximumNodeLTSVersion(),
			validate: isNumber
		},
		{
			name: 'minimumSupportNodeVersion',
			message: 'What is the minimum node version for support?',
			default: getPackageNodeEngineVersion() || await getMinimumNodeLTSVersion(),
			validate: isNumber,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'maximumSupportNodeVersion',
			message: 'What is the maximum node version for support?',
			default: await getMaximumNodeLTSVersion(),
			validate: isNumber,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'minimumTestNodeVersion',
			message: 'What is the minimum node version for testing?',
			default: nodeVersions[0],
			validate: isNumber,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'maximumTestNodeVersion',
			message: 'What is the maximum node version for testing?',
			default: nodeVersions[nodeVersions.length - 1],
			validate: isNumber,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'babel',
			type: 'confirm',
			message: 'Will you use babel to support older environments?',
			default () {
				const result = hasMultipleEditions()
				return result == null ? true : result
			},
			when ({ type, language }) {
				return type !== 'website' && language === 'esnext'
			}
		},
		{
			name: 'docs',
			type: 'confirm',
			message: 'Will there be inline source code documentation?',
			default: getPackageDocumentationDependency() || false,
			when ({ type }) {
				return type === 'code'
			}
		},
		{
			name: 'flowtype',
			type: 'confirm',
			message: 'Will it use flow type for strong type checking?',
			default: getPackageFlowtypeDependency() || false,
			when ({ type, language }) {
				return type === 'code' && (language === 'esnext' || language === 'javascript')
			}
		},
		{
			name: 'modules',
			type: 'confirm',
			message: 'Will it use ES6 Modules?',
			default: getPackageModules() || false,
			when ({ type, language }) {
				return type === 'code' && language === 'esnext'
			}
		},
		{
			name: 'author',
			message: 'Who will the package author be?',
			default: getPackageAuthor() || `${new Date().getFullYear()}+ ${await getGitUserName() || 'name'} <${await getGitUserEmail() || 'email'}>`,
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'travis',
			type: 'confirm',
			message: 'Would you like to update travis configuration?',
			default: true
		},
		{
			name: 'npmAuthToken',
			message: 'What will be the npm auth token for releasing on travis?',
			default: 'bevry',
			filter: trim,
			when ({ travis, publish }) { return travis && publish && !defaults.npmAuthToken }
		},
		{
			name: 'npmUsername',
			message: 'What will be the npm username for releasing on travis?',
			default: 'bevry',
			validate: isSpecified,
			filter: trim,
			when ({ travis, publish, npmAuthToken }) { return travis && publish && !defaults.npmUsername && !npmAuthToken }
		},
		{
			name: 'npmEmail',
			message: 'What will be the npm email for releasing on travis?',
			default: 'us@bevry.me',
			validate: isSpecified,
			filter: trim,
			when ({ travis, publish, npmAuthToken }) { return travis && publish && !defaults.npmEmail && !npmAuthToken }
		},
		{
			name: 'npmPassword',
			type: 'password',
			message: 'What will be the npm password for releasing on travis?',
			validate: isSpecified,
			filter: trim,
			when ({ travis, publish, npmAuthToken }) { return travis && publish && !defaults.npmPassword && !npmAuthToken }
		},
		{
			name: 'surgeLogin',
			message: 'For deploying the documentation, what is your surge username?',
			validate: isSpecified,
			filter: trim,
			when ({ travis, docs, deployWithSurge }) { return travis && (docs || deployWithSurge) && !defaults.surgeLogin }
		},
		{
			name: 'surgeToken',
			type: 'password',
			message: 'For deploying the documentation, what is your surge token?',
			validate: isSpecified,
			filter: trim,
			when ({ travis, docs, deployWithSurge }) { return travis && (docs || deployWithSurge) && !defaults.surgeToken }
		},
		{
			name: 'travisEmail',
			message: 'What will be the travis notification email?',
			default: 'travisci@bevry.me',
			validate: isSpecified,
			filter: trim,
			when ({ travis }) { return travis && !defaults.travisEmail }
		},
		{
			name: 'slackSubdomain',
			message: 'What will be the slack subdomain for releasing on travis?',
			default: 'bevry',
			validate: isSpecified,
			filter: trim,
			when ({ travis }) { return travis && !defaults.slackSubdomain }
		},
		{
			name: 'slackToken',
			type: 'password',
			message: 'What will be the slack token for travis notifications?',
			validate: isSpecified,
			filter: trim,
			when ({ travis }) { return travis && !defaults.slackToken }
		}
	]
}


// ================================================
// Do the magic

async function getAnswers () {
	try {
		return await inquirer.prompt(await getQuestions())
	}
	catch (err) {
		return Promise.reject(
			new Error(`Failed to fetch the answers from the user: ${stackOrMessage(err)}`)
		)
	}
}

async function init () {
	// Prepare
	const answers = Object.assign(defaults, await getAnswers())
	const isJavaScript = ['esnext', 'javascript', 'json'].indexOf(answers.language) !== -1
	const unlinkFiles = [
		'esnextguardian.js',
		'nakefile.js',
		'Cakefile',
		'cyclic.js',
		'.jshintrc',
		'.jscrc'
	]

	// Website projects should only support a single node version
	if (answers.type !== 'code') {
		answers.minimumSupportNodeVersion
			= answers.maximumSupportNodeVersion
			= answers.minimumTestNodeVersion
			= answers.maximumTestNodeVersion
			= answers.desiredNodeVersion
	}

	// rename old files
	console.log('renaming old files')
	if (await util.exists('history.md')) {
		await util.rename('history.md', 'HISTORY.md')
	}
	if (answers.type === 'code') {
		if (await util.exists('src')) {
			await util.rename('src', 'source')
		}
	}

	// setup the package data variables
	const packageDataLocal = getPackage()
	const customPackageScripts = {}
	if (packageDataLocal) {
		Object.keys(packageDataLocal.scripts).forEach(function (key) {
			if (key.indexOf('my:') === 0) {
				const value = packageDataLocal.scripts[key]
				customPackageScripts[key] = value
			}
		})
	}
	if (packageDataLocal && packageDataLocal.scripts) {
		if (packageDataLocal.scripts.deploy) {
			customPackageScripts['my:deploy'] = packageDataLocal.scripts.deploy
		}
	}
	const packageData = Object.assign(
		{
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
			badges: {
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
					'wishlist',
					'---',
					'slackin'
				],
				config: {
					patreonUsername: 'bevry',
					opencollectiveUsername: 'bevry',
					flattrUsername: 'balupton',
					paypalURL: 'https://bevry.me/paypal',
					bitcoinURL: 'https://bevry.me/bitcoin',
					wishlistURL: 'https://bevry.me/wishlist',
					slackinURL: 'https://slack.bevry.me'
				}
			},
			scripts: Object.assign(
				{
					'our:setup': '',
					'our:setup:npm': 'npm install',
					'our:setup:docpad': '',
					'our:clean': 'rm -Rf ./docs ./es2015 ./es5 ./out',
					'our:compile': '',
					'our:compile:coffee:esnext': '',
					'our:compile:coffee:es2015': '',
					'our:compile:es2015': '',
					'our:meta': '',
					'our:meta:docs': '',
					'our:meta:yuidoc': '',
					'our:meta:biscotto': '',
					'our:meta:projectz': 'projectz compile',
					'our:verify': '',
					'our:verify:coffeelint': '',
					'our:verify:eslint': '',
					'our:verify:flow': '',
					'our:deploy': '',
					'our:test': 'npm run our:verify && npm test',
					'our:release': '',
					'our:release:prepare': 'npm run our:clean && npm run our:compile && npm run our:test && npm run our:meta'
				},
				answers.publish ? {
					'our:release:check-changelog': 'cat ./HISTORY.md | grep v$npm_package_version || (echo add a changelog entry for v$npm_package_version && exit -1)',
					'our:release:check-dirty': 'git diff --exit-code',
					'our:release:tag': "export MESSAGE=$(cat ./HISTORY.md | sed -n \"/## v$npm_package_version/,/##/p\" | sed 's/## //' | awk 'NR>1{print buf}{buf = $0}') && test \"$MESSAGE\" || (echo 'proper changelog entry not found' && exit -1) && git tag v$npm_package_version -am \"$MESSAGE\"",
					'our:release:push': 'git push origin master && git push origin --tags'
				} : {
					'our:release:push': 'git push origin master && git push origin --tags'
				},
				customPackageScripts,
				{
					start: (packageDataLocal && packageDataLocal.scripts && packageDataLocal.scripts.start) || '',
					test: (packageDataLocal && packageDataLocal.scripts && packageDataLocal.scripts.test) || ''
				}
			)
		}
	)

	// customise package data
	console.log('customising package data')
	if (answers.type === 'code') {
		packageData.engines.node = `>=${answers.minimumSupportNodeVersion}`
	}
	else {
		packageData.engines.node = `${answers.desiredNodeVersion}`
	}
	if (packageData.license && packageData.license.type) {
		packageData.license = packageData.license.type
	}

	// remove old fields
	delete packageData.nakeConfiguration
	delete packageData.cakeConfiguration
	delete packageData.directories

	// customise editions
	let useEditionAutoloader = false
	if (answers.type === 'website') {
		delete packageData.main
	}
	else {
		if (isJavaScript && packageData.editions) {
			// trim edition directory of edition entry if it is there (converts editions v1.0 to v1.1+)
			packageData.editions.forEach(function (edition) {
				if (edition.directory === '.') {
					delete edition.directory
				}
				if (edition.entry && edition.directory && edition.entry.indexOf(edition.directory) === 0) {
					edition.entry = edition.entry.substr(edition.directory.length + 1)
				}
			})
		}
		else {
			const editions = []
			if (answers.language === 'esnext') {
				editions.push({
					description: 'Source + ESNext',
					directory: 'source',
					entry: `${answers.mainEntry}.js`,
					syntaxes: [
						'javascript',
						'esnext'
					]
				})
				if (answers.modules) {
					editions[0].description += ' + Import'
					editions[0].syntaxes.push('import')
				}
				else {
					editions[0].description += ' + Require'
					editions[0].syntaxes.push('require')
				}
				if (answers.flowtype) {
					editions[0].description += ' + Flow Type Comments'
					editions[0].syntaxes.push('flow type comments')
				}
				if (answers.babel) {
					editions.push({
						description: 'Babel Compiled + ES2015 + Require',
						directory: 'es2015',
						entry: `${answers.mainEntry}.js`,
						syntaxes: [
							'javascript',
							'es2015',
							'require'
						]
					})
				}
			}
			else if (answers.language === 'coffeescript') {
				editions.push(
					{
						description: 'Source + CoffeeScript + Require',
						directory: 'source',
						entry: `${answers.mainEntry}.coffee`,
						syntaxes: [
							'coffeescript',
							'require'
						]
					},
					{
						description: 'CoffeeScript Compiled + ESNext + Require',
						directory: 'esnext',
						entry: `${answers.mainEntry}.js`,
						syntaxes: [
							'javascript',
							'esnext',
							'require'
						]
					},
					{
						description: 'CoffeeScript Compiled + ES2015 + Require',
						directory: 'es2015',
						entry: `${answers.mainEntry}.js`,
						syntaxes: [
							'javascript',
							'es2015',
							'require'
						]
					}
				)
			}
			else if (answers.language === 'javascript') {
				editions.push(
					{
						description: 'JavaScript + Require',
						directory: '.',
						entry: `${answers.mainEntry}.js`,
						syntaxes: [
							'javascript',
							'require'
						]
					}
				)
			}
			else if (answers.language === 'json') {
				editions.push(
					{
						description: 'JSON',
						directory: '.',
						entry: `${answers.mainEntry}.json`,
						syntaxes: [
							'json'
						]
					}
				)
			}
			packageData.editions = editions
		}
		useEditionAutoloader = packageData.editions.length > 1
		const sourceEdition = packageData.editions[0]
		const compiledEdition = packageData.editions[packageData.editions.length - 1]
		const sourceExtension = sourceEdition.entry.replace(/^.+\./, '')
		const compiledExtension = compiledEdition.entry.replace(/^.+\./, '')
		const sourceMainPath = pathUtil.join(sourceEdition.directory || '.', answers.mainEntry + '.' + sourceExtension)
		const sourceTestPath = pathUtil.join(sourceEdition.directory || '.', answers.testEntry + '.' + sourceExtension)
		const compiledMainPath = pathUtil.join(compiledEdition.directory || '.', answers.mainEntry + '.' + compiledExtension)
		const compiledTestPath = pathUtil.join(compiledEdition.directory || '.', answers.testEntry + '.' + compiledExtension)

		// customise entry
		let mainPath, testPath
		if (useEditionAutoloader) {
			mainPath = 'index.js'
			testPath = 'test.js'
			await util.write('index.js', [
				"'use strict'",
				'',
				"module.exports = require('editions').requirePackage(__dirname, require)",
				''
			].join('\n'))
			await util.write('test.js', [
				"'use strict'",
				'',
				`module.exports = require('editions').requirePackage(__dirname, require, '${answers.testEntry}')`,
				''
			].join('\n'))
		}
		else {
			mainPath = compiledMainPath
			testPath = compiledTestPath
		}
		packageData.main = mainPath
		packageData.scripts.test = `node --harmony ./${testPath} --joe-reporter=console`
		if (answers.publish != null) {
			if (answers.publish) {
				delete packageData.private
			}
			else {
				packageData.private = true
			}
		}
		if (answers.browser) {
			if (answers.publish) {
				packageData.browser = compiledMainPath
			}
			else {
				delete packageData.browser
			}
		}

		// scaffold
		console.log('scaffolding edition files')
		await util.spawn(['mkdir', '-p'].concat(
			packageData.editions.map(
				(edition) => edition.directory || '.'
			)
		))
		await util.spawn(['touch', sourceMainPath, sourceTestPath])
	}

	// customise badges
	console.log('customising badges')
	const removeBadges = ['gratipay']
	if (packageData.private) {
		removeBadges.push(
			'npmversion',
			'npmdownloads',
			'daviddm',
			'daviddmdev'
		)
	}
	packageData.badges.list = packageData.badges.list.filter((i) => removeBadges.indexOf(i) === -1)
	delete packageData.badges.gratipayUsername

	// download files
	console.log('downloading files')
	const downloads = [
		'https://raw.githubusercontent.com/bevry/base/master/.editorconfig',
		{ url: 'https://raw.githubusercontent.com/bevry/base/master/.gitignore', custom: true },
		'https://raw.githubusercontent.com/bevry/base/master/LICENSE.md',
		'https://raw.githubusercontent.com/bevry/base/master/CONTRIBUTING.md'
	]
	if (answers.type === 'code') {
		downloads.push({ url: 'https://raw.githubusercontent.com/bevry/base/master/HISTORY.md', overwrite: false })
	}
	if (answers.publish) {
		downloads.push({ url: 'https://raw.githubusercontent.com/bevry/base/master/.npmignore', custom: true })
	}
	else {
		unlinkFiles.push('.npmignore')
	}
	if (isJavaScript) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/.eslintrc.js')
		if (answers.flowtype) {
			downloads.push('https://raw.githubusercontent.com/bevry/base/master/.flowconfig')
		}
		else {
			unlinkFiles.push('.flowconfig')
		}
	}
	else {
		unlinkFiles.push('.flowconfig')
		if (answers.language === 'coffeescript') {
			downloads.push('https://raw.githubusercontent.com/bevry/base/34fc820c8d87f1f21706ce7e26882b6cd5437368/coffeelint.json')
		}
	}
	if (answers.docpadPlugin) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/docpad-setup.sh')
	}
	else {
		unlinkFiles.push('docpad-setup.sh')
	}
	await Promise.all(downloads.map((i) => download(i)))

	// write the readme file
	console.log('writing readme file')
	if ((await util.exists('README.md')) === false) {
		await util.write('README.md', [
			'<!--TITLE -->',
			'',
			'<!--BADGES -->',
			'',
			'<!--DESCRIPTION -->',
			'',
			'<!--INSTALL -->',
			'',
			'## Usage',
			'',
			'<!--HISTORY -->',
			'<!--CONTRIBUTE -->',
			'<!--BACKERS -->',
			'<!--LICENSE -->'
		].join('\n'))
	}

	// convert the history file
	if (answers.type === 'code') {
		console.log('updating history file standard')
		let historyContent = await util.read('HISTORY.md')
		historyContent = historyContent.toString()
		if (/^##/m.test(historyContent) === false) {
			historyContent = historyContent
				.replace(/^-/gm, '##')
				.replace(/^\t/gm, '')
		}
		historyContent = historyContent.replace(/^(## v\d+\.\d+\.\d+) ([a-z]+ \d+), (\d+)$/gim, '$1 $3 $2')
		await util.write('HISTORY.md', historyContent)
	}

	// customise travis
	if (answers.travis) {
		console.log('customising travis')

		// grab the latest awesome-travis commit
		const githubAuth =
			(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
				? `client_id=${process.env.GITHUB_CLIENT_ID}&client_secret=${process.env.GITHUB_CLIENT_SECRET}`
				: ''
		let awesomeTravisCommit = 'master', awesomeTravisError = null
		try {
			const awesomeTravisCommitReponse = await fetch(`https://api.github.com/repos/bevry/awesome-travis/commits?${githubAuth}`, {
				headers: {
					Accept: 'application/vnd.github.v3+json'
				}
			})
			const awesomeTravisCommitJSON = await awesomeTravisCommitReponse.json()
			awesomeTravisError = awesomeTravisCommitJSON.message
			awesomeTravisCommit = awesomeTravisCommitJSON[0].sha
		}
		catch (err) {
			console.log('fetching the latest travis commit failed, so using master', awesomeTravisError, err)
		}

		// generate structure
		const travis = {
			sudo: false,
			language: 'node_js',
			node_js: nodeVersions,
			matrix: {
				fast_finish: true,
				allow_failures: []
			},
			cache: {
				directories: [
					'$HOME/.npm',
					'$HOME/.yarn-cache'
				]
			},
			install: [
				`eval "$(curl ${CURL_FLAGS} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-install.bash)"`
			],
			before_script: [
				`eval "$(curl ${CURL_FLAGS} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-verify.bash)"`
			],
			after_success: []
		}

		// trim node versions that we do not care about
		travis.node_js = travis.node_js
			.filter((version) =>
				semver(version, answers.minimumTestNodeVersion) >= 0
				&&
				semver(version, answers.maximumTestNodeVersion) <= 0
			)
		travis.matrix.allow_failures = travis.node_js
			.filter((version) =>
				semver(version, answers.minimumSupportNodeVersion) < 0
				||
				semver(version, answers.maximumSupportNodeVersion) > 0
			)
			.map(function (version) {
				return { node_js: version }
			})

		// travis env variables
		// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
		console.log('travis environment variables')
		await util.spawn(['travis', 'enable'])
		await util.spawn(['travis', 'env', 'set', 'DESIRED_NODE_VERSION', answers.desiredNodeVersion, '--public'])
		if (answers.docs || answers.deployWithSurge) {
			await util.spawn(['travis', 'env', 'set', 'SURGE_LOGIN', answers.surgeLogin, '--public'])
			await util.spawn(['travis', 'env', 'set', 'SURGE_TOKEN', answers.surgeToken])
			if (answers.docs) {
				travis.after_success.push(
					`eval "$(curl ${CURL_FLAGS} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/surge.bash)"`
				)
			}
			else {
				travis.after_success.push(
					`eval "$(curl ${CURL_FLAGS} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/deploy-custom.bash)"`
				)
			}
		}
		else {
			await util.spawn(['travis', 'env', 'unset', 'SURGE_LOGIN', 'SURGE_TOKEN'])
		}
		if (answers.publish) {
			if (answers.npmAuthToken) {
				await util.spawn(['travis', 'env', 'set', 'NPM_AUTHTOKEN', answers.npmAuthToken])
				await util.spawn(['travis', 'env', 'unset', 'NPM_USERNAME', 'NPM_PASSWORD', 'NPM_EMAIL'])
			}
			else {
				await util.spawn(['travis', 'env', 'unset', 'NPM_AUTHTOKEN'])
				await util.spawn(['travis', 'env', 'set', 'NPM_USERNAME', answers.npmUsername, '--public'])
				await util.spawn(['travis', 'env', 'set', 'NPM_PASSWORD', answers.npmPassword])
				await util.spawn(['travis', 'env', 'set', 'NPM_EMAIL', answers.npmEmail])
			}
			travis.after_success.push(
				`eval "$(curl ${CURL_FLAGS} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
			)
		}

		// output the written variables
		await util.spawn(['travis', 'env', 'list'])

		// write the .travis.yml file
		// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
		console.log('write the .travis.yml file')
		await util.write('.travis.yml', yaml.dump(travis))
		await util.spawn(['travis', 'encrypt', `${answers.slackSubdomain}:${answers.slackToken}#updates`, '--add', 'notifications.slack'])
		await util.spawn(['travis', 'encrypt', answers.travisEmail, '--add', 'notifications.email.recipients'])
	}

	// customise scripts
	console.log('customise scripts')
	if (answers.docpadPlugin) {
		packageData.scripts['our:setup:docpad'] = 'bash ./docpad-setup.sh'
	}
	if (answers.language === 'coffeescript') {
		packageData.scripts['our:compile:coffee:esnext'] = 'coffee -bco ./esnext ./source'
		packageData.scripts['our:compile:coffee:es2015'] = 'coffee -bcto ./es2015 ./source'
		packageData.scripts['our:verify:coffeelint'] = 'coffeelint ./source'
		if (answers.docs) {
			if (packageData.devDependencies.biscotto) {
				packageData.scripts['our:meta:biscotto'] = 'biscotto -n "$npm_package_title" --title "$npm_package_title API Documentation" --readme README.md --output-dir docs source - LICENSE.md HISTORY.md'
			}
			else {
				packageData.scripts['our:meta:yuidoc'] = 'yuidoc -o ./docs --syntaxtype coffee -e .coffee ./source'
			}
		}
	}
	else if (isJavaScript) {
		packageData.scripts['our:verify:eslint'] = 'eslint --fix ./source'
		if (answers.babel) {
			packageData.scripts['our:compile:es2015'] = 'babel ./source --out-dir ./es2015 --presets es2015'
		}
		if (answers.docs) {
			packageData.scripts['our:meta:docs'] = 'documentation build -f html -o ./docs -g --shallow ./source/**.js'
		}
		if (answers.flowtype) {
			packageData.scripts['our:verify:flow'] = 'flow check'
		}
	}
	mergeScript(packageData, 'our:setup', /^(our|my):setup/)
	mergeScript(packageData, 'our:compile', /^(our|my):compile/)
	mergeScript(packageData, 'our:meta', /^(our|my):meta/)
	mergeScript(packageData, 'our:verify', /^(our|my):verify/)
	mergeScript(packageData, 'our:release', /^(our|my):release/) // (:[^:]+)?$
	mergeScript(packageData, 'our:deploy', /^(our|my):deploy/)
	// test is a special instance, so do not do it on test
	Object.keys(packageData.scripts).forEach(function (key) {
		if (packageData.scripts[key] === '') {
			delete packageData.scripts[key]
		}
	})

	// write the package.json file
	console.log('writing the package.json file...')
	await util.write('package.json',
		JSON.stringify(arrangePackage(packageData), null, '  ')
	)
	console.log('..wrote the package.json file')

	// prepare the development dependencies
	/** @type {Object.<string, boolean | string>} */
	const packages = {
		'projectz': 'dev',
		'assert-helpers': false,
		'joe': false,
		'joe-reporter-console': false,
		'editions': useEditionAutoloader,
		'surge': (answers.docs || answers.deployWithSurge) ? 'dev' : false,
		'eslint': false,
		'babel-cli': false,
		'babel-core': false,
		'babel-preset-es2015': false,
		'documentation': false,
		'flow-bin': false,
		'coffee-script': false,
		'coffeescript': false,
		'yuidocjs': false
	}
	if (answers.docpadPlugin || packageData.devDependencies.docpad) {
		packages.docpad = 'dev'
	}
	else if (answers.type !== 'website') {
		packages.joe = packages['joe-reporter-console'] = packages['assert-helpers'] = 'dev'
	}
	if (isJavaScript) {
		packages.eslint = 'dev'
		if (answers.babel) packages['babel-cli'] = packages['babel-preset-es2015'] = 'dev'
		if (answers.docs) packages.documentation = 'dev'
		if (answers.flowtype) packages['flow-bin'] = 'dev'
	}
	else if (answers.language === 'coffeescript') {
		if (packageData.dependencies.coffeescript || packageData.dependencies['coffee-script']) {
			packages.coffeescript = packages.coffeelint = true
		}
		else {
			packages.coffeescript = packages.coffeelint = 'dev'
		}
		if (answers.docs && !packageData.devDependencies.biscotto) packages.yuidocjs = 'dev'
		packages['babel-core'] = packages['babel-preset-es2015'] = 'dev'
		await util.write('.babelrc', '{"presets": ["es2015"] }')
	}

	// install the development dependencies
	const addDependencies = Object.keys(packages).filter((key) => packages[key] === true)
	const addDevDependencies = Object.keys(packages).filter((key) => packages[key] === 'dev')
	const removeDependencies = Object.keys(packages).filter((key) => packages[key] === false && (packageData.dependencies[key] || packageData.devDependencies[key]))
	if (addDependencies.length) {
		console.log('adding the dependencies...\n')
		await util.spawn(['npm', 'install', '--save'].concat(addDependencies))
		console.log('\n...added the dependencies')
	}
	if (addDevDependencies.length) {
		console.log('adding the development dependencies...\n')
		await util.spawn(['npm', 'install', '--save-dev'].concat(addDevDependencies))
		console.log('\n...added the development dependencies')
	}
	if (removeDependencies.length) {
		console.log('remove old dependencies...\n')
		await util.spawn(['npm', 'uninstall', '--save', '--save-dev'].concat(removeDependencies))
		console.log('\n...removed old dependencies')
	}

	console.log('upgrading the installed dependencies...\n')
	await util.spawn(['npm', 'install', '-g', 'npm-check-updates'])
	await util.spawn(['ncu', '-u'])
	console.log('\n...upgrading all the installed dependencies')

	console.log('installing the dependencies...\n')
	await util.spawn(['npm', 'install'])
	console.log('\n...installed all the dependencies')

	// remove old files
	console.log('removing old files...')
	await Promise.all(unlinkFiles.map((file) => util.unlink(file)))
	console.log('...removed old files')

	// running setup
	console.log('running setup...\n')
	await util.spawn('npm run our:setup')
	console.log('\n...running setup')

	console.log('running setup...\n')
	await util.spawn('npm run our:setup')
	console.log('\n...running setup')

	// test everything
	console.log('all finished, testing with release preparation...\n')
	await util.spawn('npm run our:release:prepare')
	console.log('\n...all done')
}

init()
