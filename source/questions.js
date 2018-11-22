'use strict'

// External
const pathUtil = require('path')

// Local
const defaults = require('./data')
const _getAnswers = require('./answers').getAnswers
const { allNodeVersions } = require('./data')
const { isNumber, isGitUrl, isSpecified, trim } = require('./string')
const {
	getGitBranch,
	getGitEmail,
	getGitOrganisation,
	getGitOriginUrl,
	getGitProject,
	getGitUsername
} = require('./get-git')
const {
	getMaximumNodeLTSVersion,
	getMinimumNodeLTSVersion
} = require('./get-node')
const {
	getNowAliases,
	getNowName,
	getPackageProperty,
	getPackageAuthor,
	getPackageDescription,
	getPackageFlowtypeDependency,
	getPackageKeywords,
	getPackageMainEntry,
	getPackageModules,
	getPackageName,
	getPackageNodeEngineVersion,
	getPackageOrganisation,
	getPackageRepoUrl,
	getPackageTestEntry,
	isPackageCoffee,
	isPackageDocPadPlugin,
	isPackageDocPadWebsite,
	isPackageJavaScript,
	isPackageTypeScript,
	isPackageJSON,
	isPackageWebsite
} = require('./package')

// ====================================
// Questions

async function getQuestions({ packageData = {}, cwd }) {
	const browsers = getPackageProperty(packageData, 'browsers')
	const browser = Boolean(
		browsers || getPackageProperty(packageData, 'browser')
	)
	const browsersList = typeof browsers === 'string' ? browsers : 'defaults'
	return [
		{
			name: 'name',
			message: 'What will be the package name?',
			default: getPackageName(packageData) || pathUtil.basename(cwd),
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'description',
			message: 'and the package description?',
			default: getPackageDescription(packageData),
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'keywords',
			message: 'What are some keywords to describe the project?',
			default: getPackageKeywords(packageData),
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'repoUrl',
			message: 'What will the git URL be?',
			default: (await getGitOriginUrl(cwd)) || getPackageRepoUrl(cwd),
			validate: isGitUrl,
			filter: trim
		},
		{
			name: 'author',
			message: 'Who will the package author be?',
			default:
				getPackageAuthor(packageData) ||
				`${new Date().getFullYear()}+ ${(await getGitUsername(cwd)) ||
					'name'} <${(await getGitEmail(cwd)) || 'email'}>`,
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'organisation',
			message: 'What is the organisation username for the package?',
			default:
				(await getGitOrganisation(cwd)) || getPackageOrganisation(packageData)
		},
		{
			name: 'website',
			type: 'confirm',
			message: 'Will this project be a website?',
			default: isPackageWebsite(packageData) || false
		},
		{
			name: 'docpadWebsite',
			type: 'confirm',
			message: 'Will this website be generated using DocPad?',
			default: isPackageDocPadWebsite(packageData) || false,
			when({ website }) {
				return website
			}
		},
		{
			name: 'languages',
			type: 'checkbox',
			choices: ['esnext', 'typescript', 'coffeescript', 'json', 'html', 'css'],
			message: 'What programming languages will the source code be written in?',
			validate: isSpecified,
			default: (
				[
					isPackageJavaScript(packageData) && 'esnext',
					isPackageTypeScript(packageData) && 'typescript',
					isPackageCoffee(packageData) && 'coffeescript',
					isPackageJSON(packageData) && 'json',
					isPackageWebsite(packageData) && 'html',
					isPackageWebsite(packageData) && 'css'
				]
					.filter(value => value)
					.join(' ') || 'esnext'
			).split(' ')
		},
		{
			name: 'language',
			type: 'list',
			message: 'Which programming language will be the primary one?',
			validate: isSpecified,
			choices({ languages }) {
				return languages
			},
			default({ languages }) {
				return languages[0]
			}
		},
		{
			name: 'docpadPlugin',
			type: 'confirm',
			message: 'Will it be a DocPad plugin?',
			default: isPackageDocPadPlugin(packageData) || false,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'npm',
			type: 'confirm',
			message: 'Will it be published to npm?',
			default: getPackageProperty(packageData, 'private') !== true,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'browser',
			type: 'confirm',
			message: 'Will it be used on the client-side inside web browsers?',
			default: browser,
			when({ website, docpadPlugin }) {
				return !website && !docpadPlugin
			}
		},
		{
			name: 'browsers',
			message: 'Which web browsers will be supported?',
			default: browsersList,
			when({ browser, language }) {
				return browser && language !== 'json'
			}
		},
		{
			name: 'sourceDirectory',
			message: 'Which directory will the source code be located in?',
			default({ docpadWebsite }) {
				return docpadWebsite ? 'src' : 'source'
			},
			validate: isSpecified,
			filter: trim
		},
		{
			name: 'mainEntry',
			message: 'What is the main entry filename (without extension)?',
			default: getPackageMainEntry(packageData) || 'index',
			validate: isSpecified,
			filter: trim,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'testEntry',
			message: 'What is the test entry filename (without extension)?',
			default: getPackageTestEntry(packageData) || 'test',
			validate: isSpecified,
			filter: trim,
			when({ website }) {
				return !website
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
			default:
				getPackageNodeEngineVersion(packageData) ||
				(await getMinimumNodeLTSVersion()),
			validate: isNumber,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'maximumSupportNodeVersion',
			message: 'What is the maximum node version for support?',
			default: allNodeVersions[allNodeVersions.length - 1],
			validate: isNumber,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'minimumTestNodeVersion',
			message: 'What is the minimum node version for testing?',
			default: allNodeVersions[0],
			validate: isNumber,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'maximumTestNodeVersion',
			message: 'What is the maximum node version for testing?',
			default: allNodeVersions[allNodeVersions.length - 1],
			validate: isNumber,
			when({ website }) {
				return !website
			}
		},
		{
			name: 'upgradeAllDependencies',
			type: 'confirm',
			message: 'Should all dependencies be upgraded to their latest versions?',
			default: false
		},
		{
			name: 'docs',
			type: 'confirm',
			message: 'Will there be inline source code documentation?',
			default: true,
			when({ website, language }) {
				return !website && language !== 'typescript'
			}
		},
		{
			name: 'flowtype',
			type: 'confirm',
			message: 'Will it use flow type for strong type checking?',
			default: getPackageFlowtypeDependency(packageData) || false,
			when({ website, language }) {
				return !website && language === 'esnext'
			}
		},
		{
			name: 'modules',
			type: 'confirm',
			message: 'Will it use ES6 Modules?',
			default: getPackageModules(packageData) || false,
			when({ website, language }) {
				return !website && language === 'esnext'
			}
		},
		{
			name: 'deploy',
			type: 'list',
			choices: ['now-static', 'now-custom', 'surge', 'custom', 'other'],
			message: 'Which website deployment strategy would you like to use?',
			default: 'now-static',
			when({ website }) {
				return website
			}
		},
		{
			name: 'deployBranch',
			message: 'For deploying the website, which branch should be deployed?',
			default: (await getGitBranch(cwd)) || 'master',
			validate: isSpecified,
			filter: trim,
			when({ deploy }) {
				return deploy && deploy !== 'other'
			}
		},
		{
			name: 'nowTeam',
			message: 'For deploying the website, what now team should be used?',
			default({ organisation }) {
				return organisation
			},
			validate: isSpecified,
			filter: trim,
			when({ deploy }) {
				return deploy && deploy.startsWith('now')
			}
		},
		{
			name: 'nowToken',
			type: 'password',
			message: 'For deploying the website, what now token should be used?',
			validate: isSpecified,
			filter: trim,
			default: defaults.nowToken,
			when({ deploy }) {
				return deploy && deploy.startsWith('now')
			}
		},
		{
			name: 'nowName',
			message: 'For deploying the website, what now name should be used?',
			default: getNowName(packageData) || (await getGitProject()) || null,
			validate: isSpecified,
			filter: trim,
			when({ deploy }) {
				return deploy && deploy.startsWith('now')
			}
		},
		{
			name: 'nowAliases',
			message: 'For deploying the website, what now aliases should be used?',
			default: getNowAliases(packageData) || null,
			filter: trim,
			when({ deploy }) {
				return deploy && deploy.startsWith('now')
			}
		},
		{
			name: 'deployDirectory',
			message: 'For deploying the website, what directory should be deployed?',
			default({ docpadWebsite }) {
				return docpadWebsite ? 'out' : 'www'
			},
			validate: isSpecified,
			filter: trim,
			when({ deploy }) {
				return deploy && (deploy.startsWith('now') || deploy === 'surge')
			}
		},
		{
			name: 'surgeLogin',
			message: 'What is your surge.sh username?',
			validate: isSpecified,
			filter: trim,
			default: defaults.surgeLogin,
			when({ docs, deploy, language }) {
				return docs || deploy === 'surge' || language === 'typescript'
			}
		},
		{
			name: 'surgeToken',
			type: 'password',
			message: 'What is your surge.sh token?',
			validate: isSpecified,
			filter: trim,
			default: defaults.surgeToken,
			when({ docs, deploy, language }) {
				return docs || deploy === 'surge' || language === 'typescript'
			}
		},
		{
			name: 'npmAuthToken',
			type: 'password',
			message: 'What will be the npm auth token for releasing on travis?',
			validate: isSpecified,
			filter: trim,
			default: defaults.npmAuthToken,
			when({ npm }) {
				return npm
			}
		},
		{
			name: 'travisEmail',
			message: 'What email to use for travis notifications?',
			default: defaults.travisEmail || (await getGitEmail(cwd)) || false,
			filter: trim
		},
		{
			name: 'travisUpdateEnvironment',
			type: 'confirm',
			message:
				'Would you like to update the remote travis environment variables?',
			default: true
		}
	]
}

async function getAnswers(state) {
	const answers = await _getAnswers(await getQuestions(state))

	// if typescript ensure modules, docs
	if (answers.language === 'typescript') {
		answers.modules = answers.docs = true
	}

	// if website, ensure support for only the desired node version
	if (answers.website) {
		answers.minimumSupportNodeVersion = answers.maximumSupportNodeVersion = answers.minimumTestNodeVersion = answers.maximumTestNodeVersion =
			answers.desiredNodeVersion
	}

	// Apply
	state.answers = answers
}

module.exports = { getQuestions, getAnswers }
