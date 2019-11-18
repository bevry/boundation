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
	getPackageAuthor,
	getPackageBinEntry,
	getPackageDescription,
	getPackageFlowtypeDependency,
	getPackageKeywords,
	getPackageMainEntry,
	getPackageModules,
	getPackageName,
	getPackageNodeEngineVersion,
	getPackageOrganisation,
	getPackageProperty,
	getPackageRepoUrl,
	getPackageTestEntry,
	getProjectType,
	getWebsiteType,
	hasDocumentation,
	hasEditions,
	hasPackageDependency,
	isES5,
	isPackageCoffee,
	isPackageDocPadPlugin,
	isPackageJavaScript,
	isPackageJSON,
	isPackageTypeScript
} = require('./package')
const { getNowAliases, getNowName } = require('./website')

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
	const nodeMaximumLTSVersion = await getMaximumNodeLTSVersion()
	const minimumSupportNodeVersion = nodeEngineVersion || nodeMinimumLTSVersion
	const maximumSupportNodeVersion = allNodeVersions[allNodeVersions.length - 1]
	const alreadyLTS = nodeEngineVersion >= nodeMinimumLTSVersion
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
			name: 'type',
			type: 'list',
			choices: ['package', 'website'],
			message: 'What type of project will this be?',
			validate: isSpecified,
			default: getProjectType(packageData, nowData)
		},
		{
			name: 'website',
			type: 'list',
			choices: [
				'@now/next',
				'docpad on @now/static',
				'@now/static',
				'now',
				'surge',
				'custom',
				'external'
			],
			message: 'What type of website will this be?',
			default: getWebsiteType(packageData, nowData),
			when({ type }) {
				return type === 'website'
			}
		},
		{
			name: 'docpadWebsite',
			type: 'confirm',
			message: 'Will it be a DocPad website?',
			default({ website }) {
				return Boolean(website && website.includes('docpad'))
			},
			skip: true,
			when({ docpadWebsite }) {
				return docpadWebsite
			}
		},
		{
			name: 'staticWebsite',
			type: 'confirm',
			message: 'Will it be a static website?',
			default({ website }) {
				return Boolean(
					website && (website.includes('static') || website === 'surge')
				)
			},
			skip: true,
			when({ staticWebsite }) {
				return staticWebsite
			}
		},
		{
			name: 'staticDirectory',
			message:
				'For the static website, which directory contains the site to be deployed?',
			validate: isSpecified,
			filter: trim,
			default({ website }) {
				return website && website.includes('docpad') ? 'out' : 'www'
			},
			when({ staticWebsite }) {
				return staticWebsite
			}
		},
		{
			name: 'nowWebsite',
			type: 'confirm',
			message: 'Will it be a Now by Zeit website?',
			default({ website }) {
				return Boolean(website && website.includes('now'))
			},
			skip: true,
			when({ nowWebsite }) {
				return nowWebsite
			}
		},
		{
			name: 'nowName',
			message: 'For name should be used for the now site?',
			validate: isSpecified,
			filter: trim,
			default: getNowName(nowData) || (await getGitProject()),
			skip: getNowName(nowData),
			when({ nowWebsite }) {
				return nowWebsite
			}
		},
		{
			name: 'nowAliases',
			message: 'What aliases should be used for the now site?',
			filter: trim,
			default: getNowAliases(nowData).join(', '),
			skip({ nowAliases }) {
				return nowAliases
			},
			when({ nowWebsite }) {
				return nowWebsite
			}
		},
		{
			name: 'travisWebsite',
			type: 'confirm',
			message: 'Will it utilise a travis deploy script?',
			default({ website }) {
				return website === 'surge' || website === 'custom'
			},
			skip: true,
			when({ travisWebsite }) {
				return travisWebsite
			}
		},
		{
			name: 'nextWebsite',
			type: 'confirm',
			message: 'Will it be a Next by Zeit website?',
			default({ website }) {
				return Boolean(website && website.includes('next'))
			},
			skip: true,
			when({ nextWebsite }) {
				return nextWebsite
			}
		},
		{
			name: 'docpadPlugin',
			type: 'confirm',
			message: 'Will it be a DocPad plugin?',
			default: isPackageDocPadPlugin(packageData),
			skip({ docpadPlugin }) {
				return docpadPlugin || editioned
			},
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'packageManager',
			type: 'list',
			message: 'NPM or Yarn?',
			choices: ['npm', 'yarn'],
			default({ nowWebsite }) {
				return (nowWebsite && 'yarn') || 'npm'
			}
		},
		{
			name: 'languages',
			type: 'checkbox',
			choices: [
				'esnext',
				'typescript',
				'coffeescript',
				'json',
				'react',
				'jsx',
				'mdx',
				'html',
				'css'
			],
			message: 'What programming languages will the source code be written in?',
			validate: isSpecified,
			default({ website, nextWebsite }) {
				const types = [
					isPackageJavaScript(packageData) && 'esnext',
					isPackageTypeScript(packageData) && 'typescript',
					isPackageCoffee(packageData) && 'coffeescript',
					isES5(packageData) && 'es5',
					isPackageJSON(packageData) && 'json',
					(hasPackageDependency(packageData, 'react') || nextWebsite) &&
						'react',
					(hasPackageDependency(packageData, 'react') || nextWebsite) && 'jsx',
					website && 'html',
					website && 'css'
				]
				const typesString = types.filter(value => value).join(' ') || 'esnext'
				return typesString.split(' ')
			}
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
			},
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'modules',
			type: 'confirm',
			message: 'Will it use ES6 Modules?',
			default({ language }) {
				return Boolean(
					language === 'typescript' ? true : getPackageModules(packageData)
				)
			},
			skip({ language }) {
				return language !== 'esnext'
			}
		},
		{
			name: 'flowtype',
			type: 'confirm',
			message: 'Will it use flow type for strong type checking?',
			default({ language }) {
				return Boolean(
					language === 'esnext' && getPackageFlowtypeDependency(packageData)
				)
			},
			skip({ language }) {
				return language !== 'esnext'
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
			default({ language }) {
				return language === 'json' || browser
			},
			ignore({ website }) {
				return website
			},
			skip({ language }) {
				return language === 'json'
			}
		},
		{
			name: 'browsers',
			message: 'Which web browsers will be supported?',
			default: browsersList,
			ignore({ browser }) {
				return !browser
			},
			skip({ language }) {
				return language === 'json'
			}
		},
		{
			name: 'adaptive',
			type: 'confirm',
			message: 'Would you like adaptive support for older environments?',
			default({ language }) {
				return language !== 'json' && language !== 'es5'
			},
			skip({ browser, language }) {
				return browser || language === 'json' || language === 'es5'
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
			default: 'source',
			ignore({ website }) {
				return website
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
			default: Boolean(getPackageBinEntry(packageData)),
			skip({ bin }) {
				return bin
			},
			when({ npm }) {
				return npm
			}
		},
		{
			name: 'binEntry',
			message: 'What is the bin entry filename (without extension)?',
			validate: isSpecified,
			filter: trim,
			default: getPackageBinEntry(packageData) || 'bin',
			skip() {
				return getPackageBinEntry(packageData)
			},
			when({ bin }) {
				return bin
			}
		},
		{
			name: 'ltsNodeOnly',
			arg: '--lts',
			message: `Change the minimum supported node version from ${nodeEngineVersion} to ${nodeMinimumLTSVersion}`,
			type: 'confirm',
			default: false,
			skip({ website, adaptive }) {
				return website || alreadyLTS || !adaptive
			}
		},
		{
			name: 'desiredNodeVersion',
			message: 'What is the desired node version?',
			default({ nowWebsite }) {
				// https://zeit.co/docs/v2/serverless-functions/supported-languages/?query=node%20version#defined-node.js-version
				return nowWebsite ? '10' : nodeMaximumLTSVersion
			},
			validate: isNumber,
			skip({ ltsNodeOnly, nowWebsite }) {
				return ltsNodeOnly || nowWebsite
			}
		},
		{
			name: 'minimumSupportNodeVersion',
			message: 'What is the minimum node version for support?',
			validate: isNumber,
			default({ ltsNodeOnly, website, desiredNodeVersion }) {
				return ltsNodeOnly
					? nodeMinimumLTSVersion
					: website
					? desiredNodeVersion
					: minimumSupportNodeVersion
			},
			skip({ ltsNodeOnly, website }) {
				return ltsNodeOnly || website
			}
		},
		{
			name: 'maximumSupportNodeVersion',
			message: 'What is the maximum node version for support?',
			validate: isNumber,
			default({ ltsNodeOnly, website, desiredNodeVersion }) {
				return ltsNodeOnly
					? nodeMaximumLTSVersion
					: website
					? desiredNodeVersion
					: maximumSupportNodeVersion
			},
			skip({ ltsNodeOnly, website }) {
				return ltsNodeOnly || website
			}
		},
		{
			name: 'minimumTestNodeVersion',
			message: 'What is the minimum node version for testing?',
			validate: isNumber,
			default({
				ltsNodeOnly,
				website,
				desiredNodeVersion,
				minimumSupportNodeVersion,
				language
			}) {
				return ltsNodeOnly
					? nodeMinimumLTSVersion
					: website || language === 'json'
					? desiredNodeVersion
					: minimumSupportNodeVersion
			},
			skip({ ltsNodeOnly, website, language }) {
				return ltsNodeOnly || website || language === 'json'
			}
		},
		{
			name: 'maximumTestNodeVersion',
			message: 'What is the maximum node version for testing?',
			validate: isNumber,
			default({
				ltsNodeOnly,
				website,
				desiredNodeVersion,
				maximumSupportNodeVersion,
				language
			}) {
				return ltsNodeOnly
					? nodeMaximumLTSVersion
					: website || language === 'json'
					? desiredNodeVersion
					: maximumSupportNodeVersion
			},
			skip({ ltsNodeOnly, website, language }) {
				return ltsNodeOnly || website || language === 'json'
			}
		},
		{
			name: 'upgradeAllDependencies',
			type: 'confirm',
			message: 'Should all dependencies be upgraded to their latest versions?',
			default: true,
			ignore({ nowWebsite }) {
				return nowWebsite
			}
		},
		{
			name: 'kava',
			type: 'confirm',
			message: "Use Bevry's testing tools?",
			default: true,
			ignore({ website, nowWebsite, docpadPlugin }) {
				return docpadPlugin || (website && !nowWebsite)
			}
		},
		{
			name: 'docs',
			type: 'confirm',
			message: 'Will there be inline source code documentation?',
			default({ language }) {
				return hasDocumentation(packageData) || language === 'typescript'
			},
			skip({ language }) {
				return language === 'typescript'
			},
			ignore({ website }) {
				return website
			}
		},
		{
			name: 'travisUpdateEnvironment',
			type: 'confirm',
			message:
				'Would you like to update the remote travis environment variables?',
			default: true
		},
		{
			name: 'deployBranch',
			message: 'For deploying the website, which branch should be deployed?',
			validate: isSpecified,
			filter: trim,
			default: (await getGitBranch(cwd)) || 'master',
			when({ travisWebsite }) {
				return travisWebsite
			}
		},
		{
			name: 'surgeLogin',
			message: 'What is your surge.sh username?',
			validate: isSpecified,
			filter: trim,
			default: defaults.surgeLogin,
			skip: defaults.surgeLogin,
			when({ docs, website, travisUpdateEnvironment }) {
				return travisUpdateEnvironment && (docs || website === 'surge')
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
			when({ surgeLogin }) {
				return surgeLogin
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
			when({ npm }) {
				return npm
			}
		},
		{
			name: 'travisEmail',
			message: 'What email to use for travis notifications?',
			filter: trim,
			default: defaults.travisEmail || (await getGitEmail(cwd)),
			skip() {
				return defaults.travisEmail
			},
			when({ travisUpdateEnvironment }) {
				return travisUpdateEnvironment
			}
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
