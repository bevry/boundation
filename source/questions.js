'use strict'

// External
const pathUtil = require('path')

// Local
const defaults = require('./data')
const _getAnswers = require('./answers').getAnswers
const { allNodeVersions } = require('./data')
const { isNumber, isGitUrl, isSpecified, trim } = require('./util')
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
	getPackageBinEntry,
	isPackageCoffee,
	isPackageDocPadPlugin,
	isPackageJavaScript,
	isPackageTypeScript,
	isPackageJSON,
	hasEditions,
	hasDocumentation
} = require('./package')
const { getWebsiteType, getNowAliases, getNowName } = require('./website')

// ====================================
// Questions

async function getQuestions(state) {
	const { packageData, nowData, cwd } = state
	const browsers = getPackageProperty(packageData, 'browsers')
	const browser = Boolean(
		browsers || getPackageProperty(packageData, 'browser')
	)
	const browsersList = typeof browsers === 'string' ? browsers : 'defaults'
	const editioned = hasEditions(packageData)
	const nodeEngineVersion = getPackageNodeEngineVersion(packageData)
	const nodeMinimumLTSVersion = await getMinimumNodeLTSVersion()
	const minimumSupportNodeVersion = nodeEngineVersion || nodeMinimumLTSVersion
	const maximumSupportNodeVersion = allNodeVersions[allNodeVersions.length - 1]
	const minimumTestNodeVersion = allNodeVersions[0]
	const maximumTestNodeVersion = allNodeVersions[allNodeVersions.length - 1]
	const websiteType = getWebsiteType(state)
	return [
		{
			name: 'name',
			message: 'What will be the package name?',
			validate: isSpecified,
			filter: trim,
			default: getPackageName(packageData) || pathUtil.basename(cwd)
		},
		{
			name: 'description',
			message: 'and the package description?',
			validate: isSpecified,
			filter: trim,
			default: getPackageDescription(packageData)
		},
		{
			name: 'keywords',
			message: 'What are some keywords to describe the project?',
			validate: isSpecified,
			filter: trim,
			default: getPackageKeywords(packageData),
			skip({ keywords }) {
				return keywords
			}
		},
		{
			name: 'repoUrl',
			message: 'What will the git URL be?',
			validate: isGitUrl,
			filter: trim,
			default: (await getGitOriginUrl(cwd)) || getPackageRepoUrl(cwd)
		},
		{
			name: 'author',
			message: 'Who will the package author be?',
			validate: isSpecified,
			filter: trim,
			default:
				getPackageAuthor(packageData) ||
				`${new Date().getFullYear()}+ ${(await getGitUsername(cwd)) ||
					'name'} <${(await getGitEmail(cwd)) || 'email'}>`
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
			default: Boolean(websiteType),
			skip({ website }) {
				return website || editioned
			}
		},
		{
			name: 'docpadWebsite',
			type: 'confirm',
			message: 'Will this website be generated using DocPad?',
			default: websiteType === 'docpad',
			skip({ docpadWebsite }) {
				return docpadWebsite || editioned
			},
			ignore({ website }) {
				return !website
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
					getWebsiteType(state) && 'html',
					getWebsiteType(state) && 'css'
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
			},
			skip({ languages }) {
				return languages.length === 1
			}
		},
		{
			name: 'docpadPlugin',
			type: 'confirm',
			message: 'Will it be a DocPad plugin?',
			default: isPackageDocPadPlugin(packageData) || false,
			skip({ docpadPlugin }) {
				return docpadPlugin || editioned
			},
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'npm',
			type: 'confirm',
			message: 'Will it be published to npm?',
			default: !getPackageProperty(packageData, 'private'),
			skip({ npm }) {
				return !npm || editioned
			},
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'browser',
			type: 'confirm',
			message: 'Will it be used on the client-side inside web browsers?',
			default: browser,
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'browsers',
			message: 'Which web browsers will be supported?',
			default: browsersList,
			ignore({ browser }) {
				return !browser
			}
		},
		{
			name: 'adaptive',
			type: 'confirm',
			message: 'Would you like adaptive support for older environments?',
			default: true,
			skip({ browser }) {
				return browser
			},
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'sourceDirectory',
			message: 'Which directory will the source code be located in?',
			validate: isSpecified,
			filter: trim,
			default({ docpadWebsite }) {
				return docpadWebsite ? 'src' : 'source'
			}
		},
		{
			name: 'mainEntry',
			message: 'What is the main entry filename (without extension)?',
			validate: isSpecified,
			filter: trim,
			default: getPackageMainEntry(packageData) || 'index',
			skip: editioned,
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'testEntry',
			message: 'What is the test entry filename (without extension)?',
			validate: isSpecified,
			filter: trim,
			default: getPackageTestEntry(packageData) || 'test',
			skip: editioned,
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'bin',
			message: 'Will there be a binary/executable file?',
			type: 'confirm',
			default({ website }) {
				return website ? false : Boolean(getPackageBinEntry(packageData))
			},
			skip({ website, bin }) {
				return website || bin
			}
		},
		{
			name: 'binEntry',
			message: 'What is the bin entry filename (without extension)?',
			validate: isSpecified,
			filter: trim,
			default({ bin, website }) {
				return !bin || website
					? false
					: getPackageBinEntry(packageData) || 'bin'
			},
			skip({ bin }) {
				return !bin || getPackageBinEntry(packageData)
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
			validate: isNumber,
			default({ website, desiredNodeVersion }) {
				return website ? desiredNodeVersion : minimumSupportNodeVersion
			},
			skip({ website }) {
				return website
			}
		},
		{
			name: 'maximumSupportNodeVersion',
			message: 'What is the maximum node version for support?',
			validate: isNumber,
			default({ website, desiredNodeVersion }) {
				return website ? desiredNodeVersion : maximumSupportNodeVersion
			},
			skip({ website }) {
				return website
			}
		},
		{
			name: 'minimumTestNodeVersion',
			message: 'What is the minimum node version for testing?',
			validate: isNumber,
			default({ website, desiredNodeVersion, minimumSupportNodeVersion }) {
				return website ? desiredNodeVersion : minimumSupportNodeVersion
			},
			skip({ website }) {
				return website
			}
		},
		{
			name: 'maximumTestNodeVersion',
			message: 'What is the maximum node version for testing?',
			validate: isNumber,
			default({ website, desiredNodeVersion, maximumSupportNodeVersion }) {
				return website ? desiredNodeVersion : maximumSupportNodeVersion
			},
			skip({ website }) {
				return website
			}
		},
		{
			name: 'upgradeAllDependencies',
			type: 'confirm',
			message: 'Should all dependencies be upgraded to their latest versions?',
			default: true
		},
		{
			name: 'docs',
			type: 'confirm',
			message: 'Will there be inline source code documentation?',
			default({ website, language }) {
				return website
					? false
					: hasDocumentation(packageData) || language === 'typescript'
			},
			skip({ website, language }) {
				return website || language === 'typescript'
			}
		},
		{
			name: 'flowtype',
			type: 'confirm',
			message: 'Will it use flow type for strong type checking?',
			default({ website, language }) {
				return Boolean(
					!website &&
						language === 'esnext' &&
						getPackageFlowtypeDependency(packageData)
				)
			},
			skip({ website, language }) {
				return website || language !== 'esnext'
			}
		},
		{
			name: 'modules',
			type: 'confirm',
			message: 'Will it use ES6 Modules?',
			default({ website, language }) {
				return Boolean(
					website
						? false
						: language === 'typescript'
						? true
						: getPackageModules(packageData)
				)
			},
			skip({ website, language }) {
				return website || language !== 'esnext'
			}
		},
		{
			name: 'deploy',
			type: 'list',
			choices: ['now-static', 'now-custom', 'surge', 'custom', 'other'],
			default: 'now-static',
			message: 'Which website deployment strategy would you like to use?',
			ignore({ website }) {
				return !website
			}
		},
		{
			name: 'deployBranch',
			message: 'For deploying the website, which branch should be deployed?',
			validate: isSpecified,
			filter: trim,
			default: (await getGitBranch(cwd)) || 'master',
			ignore({ deploy }) {
				return !deploy || deploy === 'other'
			}
		},
		{
			name: 'nowTeam',
			message: 'For deploying the website, what now team should be used?',
			validate: isSpecified,
			filter: trim,
			default({ organisation }) {
				return organisation
			},
			ignore({ deploy }) {
				return !deploy || !deploy.startsWith('now')
			}
		},
		{
			name: 'nowToken',
			type: 'password',
			message: 'For deploying the website, what now token should be used?',
			validate: isSpecified,
			filter: trim,
			default: defaults.nowToken,
			skip: defaults.nowToken,
			ignore({ deploy }) {
				return !deploy || !deploy.startsWith('now')
			}
		},
		{
			name: 'nowName',
			message: 'For deploying the website, what now name should be used?',
			validate: isSpecified,
			filter: trim,
			default: getNowName(nowData) || (await getGitProject()),
			skip: getNowName(nowData),
			ignore({ deploy }) {
				return !deploy || !deploy.startsWith('now')
			}
		},
		{
			name: 'nowAliases',
			message: 'For deploying the website, what now aliases should be used?',
			filter: trim,
			default: getNowAliases(nowData).join(', '),
			ignore({ deploy }) {
				return !deploy || !deploy.startsWith('now')
			}
		},
		{
			name: 'deployDirectory',
			message: 'For deploying the website, what directory should be deployed?',
			validate: isSpecified,
			filter: trim,
			default({ docpadWebsite }) {
				return docpadWebsite ? 'out' : 'www'
			},
			ignore({ deploy }) {
				return !deploy || deploy === 'custom' || deploy === 'other'
			}
		},
		{
			name: 'surgeLogin',
			message: 'What is your surge.sh username?',
			validate: isSpecified,
			filter: trim,
			default: defaults.surgeLogin,
			skip: defaults.surgeLogin,
			ignore({ docs, deploy }) {
				return !(docs || deploy === 'surge')
			}
		},
		{
			name: 'surgeToken',
			type: 'password',
			message: 'What is your surge.sh token?',
			validate: isSpecified,
			filter: trim,
			default: defaults.surgeToken,
			skip: defaults.surgeToken,
			ignore({ docs, deploy }) {
				return !(docs || deploy === 'surge')
			}
		},
		{
			name: 'npmAuthToken',
			type: 'password',
			message: 'What will be the npm auth token for releasing on travis?',
			validate: isSpecified,
			filter: trim,
			default: defaults.npmAuthToken,
			skip: defaults.npmAuthToken,
			ignore({ npm }) {
				return !npm
			}
		},
		{
			name: 'travisEmail',
			message: 'What email to use for travis notifications?',
			filter: trim,
			default: defaults.travisEmail || (await getGitEmail(cwd)),
			skip() {
				return defaults.travisEmail
			}
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
	// Fetch
	const answers = await _getAnswers(await getQuestions(state))

	// Apply
	state.answers = answers

	// Return
	return answers
}

module.exports = { getQuestions, getAnswers }
