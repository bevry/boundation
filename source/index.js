/* eslint no-sync:0, camelcase:0, no-console:0 */
'use strict'

function stackOrMessage (error) {
	return error.stack ? `\n${error.stack}` : error.toString()
}

process.on('unhandledRejection', function (reason) {
	console.error(`\nA promise FAILED with: ${stackOrMessage(reason)}`)
	process.exit(-1)
})

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
const defaults = {
	npmEmail: process.env.NPM_EMAIL,
	npmUsername: process.env.NPM_EMAIL,
	npmPassword: process.env.NPM_PASSWORD,
	travisEmail: process.env.TRAVIS_NOTIFICATION_EMAIL,
	slackSubdomain: process.env.SLACK_SUBDOMAIN,
	slackToken: process.env.SLACK_TRAVIS_TOKEN,
	surgeLogin: process.env.SURGE_LOGIN,
	surgeToken: process.env.SURGE_TOKEN
}
const state = {}

function trim (input) {
	return input.trim()
}
function slugit (input) {
	return input.replace(/[^a-zA-Z0-9.-]+/g, '')
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
function otherwise (input, value) {
	return input == null ? value : input
}

/*
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
		return new Promise(function (resolve) {
			fsUtil.exists(file, function (exists) {
				resolve(exists)
			})
		})
	},

	read (file) {
		return new Promise(function (resolve, reject) {
			fsUtil.readFile(file, function (error, data) {
				if (error) return reject(error)
				return resolve(data)
			})
		})
	},

	write (file, data) {
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
		const response = await fetch(opts.url)
		let data = await response.text()
		const file = pathUtil.join(cwd, pathUtil.basename(urlUtil.parse(opts.url).pathname))
		const exists = await util.exists(file)
		if (opts.overwrite === false) {
			return Promise.resolve()
		}
		if (exists) {
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
		throw new Error(`Download of ${opts.url} FAILED due to: ${stackOrMessage(err)}`)
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

/*
async function getGitUserName () {
	if (state.gitUserName) return state.gitUserName
	try {
		const stdout = await util.exec('git config --global user.name', { stdio: ['ignore', 'pipe', 'ignore'] })
		state.gitUserName = (stdout && stdout.toString()) || null
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
		state.gitUserEmail = (stdout && stdout.toString()) || null
		return state.gitUserEmail
	}
	catch (error) {
		return null
	}
}

async function getRemotePackage () {
	const response = await fetch('https://raw.githubusercontent.com/bevry/base/master/package.json')
	const data = await response.json()
	return data
}
*/

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

function getPackageName () {
	return (getPackage() && state.package.name) || null
}

function getPackageDescription () {
	return (getPackage() && state.package.description) || null
}

function getPackageKeywords () {
	return (getPackage() && state.package.keywords && state.package.keywords.join(', ')) || null
}

function getPackageNodeVersion () {
	return (getPackage() && state.package.engines && state.package.engines.node && state.package.engines.node.replace(/[^0-9]+/, '')) || null
}

function getPackageDocumentationDependency () {
	return (getPackage() && state.package.devDependencies && state.package.devDependencies.documentation) || null
}

function getPackageFlowtypeDependency () {
	return (getPackage() && state.package.devDependencies && state.package.devDependencies['flow-bin']) || null
}

function getPackageModules () {
	return (getPackage() && state.package.editions && state.package.editions[0] && state.package.editions.syntaxes && state.package.editions.syntaxes.indexOf('import') !== -1) || null
}

function getPackageRepoUrl () {
	return (getPackage() && state.package.repository && state.package.repository.url) || null
}

function getPackageLanguage () {
	return (getPackage() && state.package.devDependencies && state.package.devDependencies['coffee-script'] && 'coffeescript') || null
}

function getPackageBabel () {
	return (getPackage() && state.package.devDependencies && Boolean(state.package.devDependencies.babel)) || null
}

function getPackageCompile () {
	return (getPackage() && state.package.scripts && state.package.scripts['our:compile'] !== NO_NEED_SCRIPT)
}

/*
function getPackageAuthor () {
	return (getPackage() && state.package.author) || null
}
*/

function mergeScript (packageData, script) {
	packageData.scripts[script] = Object.keys(packageData.scripts)
		.filter((key) => key.indexOf(`${script}:`) === 0 && packageData.scripts[key])
		.map((key) => `npm run ${key}`)
		.join(' && ') || NO_NEED_SCRIPT
}

function arrangePackage (packageData) {
	return arrangekeys(packageData, 'title name version private description homepage license keywords badges author maintainers contributors bugs repository engines editions bin preferGlobal main browser scripts dependencies devDependencies peerDependencies')
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
			name: 'publish',
			type: 'confirm',
			message: 'Will it be published to npm?',
			default: true,
			when () { return getPackage().private == null }
		},
		{
			name: 'browser',
			type: 'confirm',
			message: 'Will it be used on the client-side inside web browsers?',
			default: false,
			when () { return getPackage().browser == null }
		},
		{
			name: 'language',
			type: 'list',
			choices: ['coffeescript', 'esnext'],
			message: 'What language will it use?',
			default: getPackageLanguage() || 'esnext'
		},
		{
			name: 'nodeVersion',
			message: 'What will be the minimum node version it will support?',
			default: getPackageNodeVersion() || '0.8',
			validate: isNumber
		},
		{
			name: 'babel',
			type: 'confirm',
			message: 'Will you use babel to support earlier node versions?',
			default: otherwise(getPackageBabel(), true),
			when ({ language }) {
				return getPackageCompile() && language === 'esnext'
			}
		},
		{
			name: 'docs',
			type: 'confirm',
			message: 'Will there be inline source code documentation?',
			default: getPackageDocumentationDependency() || false
		},
		{
			name: 'flowtype',
			type: 'confirm',
			message: 'Will it use flow type for strong type checking?',
			default: getPackageFlowtypeDependency() || false,
			when ({ language }) {
				return language === 'esnext'
			}
		},
		{
			name: 'modules',
			type: 'confirm',
			message: 'Will it use ES6 Modules?',
			default: getPackageModules() || false,
			when ({ language }) {
				return language === 'esnext'
			}
		},

		/*
		{
			name: 'author',
			message: 'Who will the package author be?',
			default: getPackageAuthor() || ((new Date()).getFullYear() + `+ ${getGitUserName() || 'name'} <${getGitUserEmail() || 'email'}>`),
			validate: isSpecified,
			filter: trim
		},
		*/

		{
			name: 'npmUsername',
			message: 'What will be the npm username for releasing on travis?',
			default: 'bevry',
			validate: isSpecified,
			filter: trim,
			when ({ publish }) { return publish && !defaults.npmUsername }
		},
		{
			name: 'npmEmail',
			message: 'What will be the npm email for releasing on travis?',
			default: 'us@bevry.me',
			validate: isSpecified,
			filter: trim,
			when ({ publish }) { return publish && !defaults.npmEmail }
		},
		{
			name: 'npmPassword',
			type: 'password',
			message: 'What will be the npm password for releasing on travis?',
			validate: isSpecified,
			filter: trim,
			when ({ publish }) { return publish && !defaults.npmPassword }
		},
		{
			name: 'surgeLogin',
			message: 'For deploying the documentation, what is your surge username?',
			validate: isSpecified,
			filter: trim,
			when ({ docs }) { return docs && !defaults.surgeLogin }
		},
		{
			name: 'surgeToken',
			type: 'password',
			message: 'For deploying the documentation, what is your surge token?',
			validate: isSpecified,
			filter: trim,
			when ({ docs }) { return docs && !defaults.surgeToken }
		},
		{
			name: 'travisEmail',
			message: 'What will be the travis notification email?',
			default: 'travisci@bevry.me',
			validate: isSpecified,
			filter: trim,
			when () { return !defaults.travisEmail }
		},
		{
			name: 'slackSubdomain',
			message: 'What will be the slack subdomain for releasing on travis?',
			default: 'bevry',
			validate: isSpecified,
			filter: trim,
			when () { return !defaults.slackSubdomain }
		},
		{
			name: 'slackToken',
			type: 'password',
			message: 'What will be the slack token for travis notifications?',
			validate: isSpecified,
			filter: trim,
			when () { return !defaults.slackToken }
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
		throw new Error(`Failed to fetch the answers from the user: ${stackOrMessage(err)}`)
	}
}

async function init () {
	const answers = Object.assign(defaults, await getAnswers())

	// setup the package data variables
	const packageDataLocal = getPackage()
	const packageData = arrangePackage(Object.assign(
		{
			license: 'MIT',
			author: `${new Date().getFullYear()}+ Bevry <us@bevry.me> (http://bevry.me)`,
			devDependencies: {}
		},
		packageDataLocal || {},
		{
			name: answers.name,
			description: answers.description,
			keywords: answers.keywords.split(/,\s*/),
			homepage: answers.repoUrl.replace(/\.git$/, ''),
			bugs: {
				url: answers.repoUrl.replace(/\.git$/, '/issues')
			},
			repository: {
				type: 'git',
				url: answers.repoUrl
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
					'gratipay',
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
					gratipayUsername: 'bevry',
					flattrUsername: 'balupton',
					paypalURL: 'https://bevry.me/paypal',
					bitcoinURL: 'https://bevry.me/bitcoin',
					wishlistURL: 'https://bevry.me/wishlist',
					slackinURL: 'https://slack.bevry.me'
				}
			},
			scripts: {
				'our:setup': '',
				'our:setup:npm': 'npm install',
				'our:setup:docpad': '',
				'our:clean': 'rm -Rf ./docs ./es2015 ./es5 ./out',
				'our:compile': '',
				'our:compile:coffee': '',
				'our:compile:es2015': '',
				'our:meta': '',
				'our:meta:docs': '',
				'our:meta:yuidoc': '',
				'our:meta:projectz': 'projectz compile',
				'our:verify': '',
				'our:verify:coffeelint': '',
				'our:verify:eslint': '',
				'our:verify:flow': '',
				'our:test': 'npm run our:verify && npm test',
				'our:release': 'npm run our:release:prepare && npm run our:release:check && npm run our:release:tag && npm run our:release:push',
				'our:release:prepare': 'npm run our:clean && npm run our:compile && npm run our:test && npm run our:meta',
				'our:release:check': 'npm run our:release:check:changelog && npm run our:release:check:dirty',
				'our:release:check:changelog': 'cat ./HISTORY.md | grep v$npm_package_version || (echo add a changelog entry for v$npm_package_version && exit -1)',
				'our:release:check:dirty': 'git diff --exit-code',
				'our:release:tag': "export MESSAGE=$(cat ./HISTORY.md | sed -n \"/## v$npm_package_version/,/##/p\" | sed 's/## //' | awk 'NR>1{print buf}{buf = $0}') && test \"$MESSAGE\" || (echo 'proper changelog entry not found' && exit -1) && git tag v$npm_package_version -am \"$MESSAGE\"",
				'our:release:push': 'git push origin master && git push origin --tags',
				'test': 'node --harmony ./test.js --joe-reporter=console'
			}
		}
	))

	// customise editions
	console.log('customising editions')
	if (!packageData.editions) {
		const editions = []
		if (answers.language === 'esnext') {
			editions.push({
				description: 'Source + ESNext',
				directory: 'source',
				entry: 'index.js',
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
					entry: 'index.js',
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
					entry: 'index.js',
					syntaxes: [
						'coffeescript',
						'require'
					]
				},
				{
					description: 'CoffeeScript Compiled + ES5 + Require',
					directory: 'es5',
					entry: 'index.js',
					syntaxes: [
						'javascript',
						'es5',
						'require'
					]
				}
			)
		}
		packageData.editions = editions
	}

	// customise engines, private, and browser
	console.log('customising package data')
	packageData.engines.node = `>=${answers.nodeVersion}`
	if (answers.publish != null) {
		if (answers.publish) {
			delete packageData.private
		}
		else {
			packageData.private = true
		}
	}
	if (answers.browser != null) {
		if (answers.publish) {
			const lastEdition = packageData.editions[packageData.editions.length - 1]
			packageData.browser = lastEdition.directory + '/' + lastEdition.entry
		}
		else {
			delete packageData.browser
		}
	}

	// customise badges
	console.log('customising badges')
	if (packageData.private) {
		const removeList = [
			'npmversion',
			'npmdownloads',
			'daviddm',
			'daviddmdev'
		]
		packageData.badges.list = packageData.badges.list.filter((i) => removeList.indexOf(i) === -1)
	}

	// download files
	console.log('downloading files')
	const downloads = [
		'https://raw.githubusercontent.com/bevry/base/master/.editorconfig',
		{ url: 'https://raw.githubusercontent.com/bevry/base/master/HISTORY.md', overwrite: false },
		{ url: 'https://raw.githubusercontent.com/bevry/base/master/.gitignore', custom: true },
		'https://raw.githubusercontent.com/bevry/base/master/LICENSE.md',
		'https://raw.githubusercontent.com/bevry/base/master/CONTRIBUTING.md',
		'https://raw.githubusercontent.com/bevry/base/master/index.js',
		'https://raw.githubusercontent.com/bevry/base/master/test.js'
	]
	if (answers.publish) {
		downloads.push({ url: 'https://raw.githubusercontent.com/bevry/base/master/.npmignore', custom: true })
	}
	if (answers.language === 'esnext') {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/.eslintrc.js')
		if (answers.flowtype) {
			downloads.push('https://raw.githubusercontent.com/bevry/base/master/.flowconfig')
		}
	}
	else if (answers.language === 'coffeescript') {
		downloads.push('https://raw.githubusercontent.com/bevry/base/34fc820c8d87f1f21706ce7e26882b6cd5437368/coffeelint.json')
	}
	if (packageData.devDependencies.docpad) {
		downloads.push('https://raw.githubusercontent.com/bevry/base/master/docpad-setup.sh')
	}
	await Promise.all(downloads.map((i) => download(i)))

	// write the readme file
	console.log('writing readme file')
	const readme = pathUtil.join(cwd, 'README.md')
	if ( (await util.exists(readme)) === false ) {
		await util.write(readme, [
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

	// customise travis
	console.log('customising travis')
	const travis = {
		sudo: false,
		language: 'node_js',
		node_js: [
			'0.8',
			'0.10',
			'0.12',
			'4',
			'6',
			'7'
		],
		matrix: {
			fast_finish: true /* ,
			allow_failures: [] */
		},
		cache: {
			directories: [
				'$HOME/.npm',
				'$HOME/.yarn-cache'
			]
		},
		install: [
			'curl https://raw.githubusercontent.com/balupton/awesome-travis/master/scripts/npm-upgrade.bash | bash -l',
			'curl https://raw.githubusercontent.com/balupton/awesome-travis/master/scripts/npm-install.bash | bash -l'
		],
		before_script: [
			'curl https://raw.githubusercontent.com/balupton/awesome-travis/master/scripts/npm-verify.bash | bash -l'
		],
		after_success: []
	}
	travis.node_js = travis.node_js.filter((version) => semver(version, answers.nodeVersion) !== -1)

	/*
	travis.matrix.allow_failures = travis.node_js
		.filter((version) => semver(version, answers.nodeVersion) === -1)
		.map((node_js) => ({ node_js }))
	*/

	// travis env variables
	console.log('travis environment variables')
	await util.exec('travis enable')
	if (answers.docs) {
		await Promise.all([
			util.exec(`travis env set SURGE_LOGIN "${answers.surgeLogin}"`),
			util.exec(`travis env set SURGE_TOKEN "${answers.surgeToken}"`)
		])
		travis.after_success.push(
			'curl https://raw.githubusercontent.com/balupton/awesome-travis/master/scripts/surge.bash | bash -l'
		)
	}
	if (answers.publish) {
		await Promise.all([
			util.exec(`travis env set NPM_USERNAME "${answers.npmUsername}"`),
			util.exec(`travis env set NPM_PASSWORD "${answers.npmPassword}"`),
			util.exec(`travis env set NPM_EMAIL "${answers.npmEmail}"`)
		])
		travis.after_success.push(
			'curl https://raw.githubusercontent.com/balupton/awesome-travis/master/scripts/npm-publish.bash | bash -l'
		)
	}

	// write the .travis.yml file
	console.log('write the .travis.yml file')
	await util.write(
		pathUtil.join(cwd, '.travis.yml'),
		'# THIS FILE IS AUTO-GENERATED BY BEVRY/BASED DO NOT MODIFY\n' + yaml.dump(travis) + '\n# THIS FILE IS AUTO-GENERATED BY BEVRY/BASED DO NOT MODIFY\n'
	)
	await Promise.all([
		util.exec(`travis encrypt "${answers.slackSubdomain}:${answers.slackToken}#updates" --add notifications.slack`),
		util.exec(`travis encrypt "${answers.travisEmail}" --add notifications.email.recipients`)
	])

	// customise scripts
	console.log('customise scripts')
	if (packageData.devDependencies.docpad) {
		packageData.scripts['our:setup:docpad'] = 'bash ./docpad-setup.sh'
	}
	if (answers.language === 'coffeescript') {
		packageData.scripts['our:compile:coffee'] = 'coffee -bco ./es5 ./source'
		packageData.scripts['our:verify:coffeelint'] = 'coffeelint ./source'
		if (answers.docs) {
			packageData.scripts['our:meta:yudoc'] = 'yuidoc -o ./docs --syntaxtype coffee -e .coffee ./source'
		}
	}
	else if (answers.language === 'esnext') {
		packageData.scripts['our:verify:eslint'] = 'eslint --fix ./source'
		if (answers.babel) {
			packageData.scripts['our:compile:es2015'] = 'babel ./source --out-dir ./es2015 --presets es2015'
		}
		if (answers.docs) {
			packageData.scripts['out:meta:docs'] = 'documentation build -f html -o ./docs -g --shallow ./source/**.js'
		}
		if (answers.flowtype) {
			packageData.scripts['our:verify:flow'] = 'flow check'
		}
	}
	mergeScript(packageData, 'our:setup')
	mergeScript(packageData, 'our:compile')
	mergeScript(packageData, 'our:meta')
	mergeScript(packageData, 'our:verify')
	Object.keys(packageData.scripts).forEach(function (key) {
		if (packageData.scripts[key] === '') {
			delete packageData.scripts[key]
		}
	})

	// write the package.json file
	await util.write(
		pathUtil.join(cwd, 'package.json'),
		JSON.stringify(packageData, null, '  ')
	)

	// prepare the development dependencies
	const packages = []
	const devPackages = ['projectz', 'assert-helpers', 'joe', 'joe-reporter-console']
	if (answers.language === 'esnext') {
		packages.push('editions')
		devPackages.push('eslint')
		if (answers.babel) devPackages.push('babel-cli', 'babel-preset-es2015')
		if (answers.docs) devPackages.push('documentation')
		if (answers.flowtype) devPackages.push('flow-bin')
	}
	else if (answers.language === 'coffeescript') {
		devPackages.push('coffee-script', 'coffeelint')
		if (answers.docs) devPackages.push('yuidoc')
	}

	// install the development dependencies
	if (packages.length) {
		console.log('adding the dependencies...')
		await util.exec(`yarn add ${packages.join(' ')}`)
		console.log('...added the dependencies')
	}
	if (devPackages.length) {
		console.log('adding the development dependencies...')
		await util.exec(`yarn add --dev ${devPackages.join(' ')}`)
		console.log('...added the development dependencies')
	}
	console.log('installing the dependencies...\n')
	await util.spawn('yarn')
	console.log('\n...installed all the dependencies')

	// test everything
	console.log('all finished, testing with release preparation...\n')
	await util.spawn('npm run our:release:prepare')
	console.log('\n...all done')
}


init()
