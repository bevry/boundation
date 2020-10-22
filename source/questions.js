// External
import * as pathUtil from 'path'

// Local
import _getAnswers from './answers.js'
import * as defaults from './defaults.js'
import {
	pwd,
	allNodeVersions,
	allTypescriptTargets,
	allLanguages,
	latestTypescriptTargets,
	ltsTypescriptTargets,
	importNodeVersions,
} from './data.js'
import {
	isNumber,
	isGitUrl,
	isSpecified,
	trim,
	repoToSlug,
	uniq,
} from './util.js'
import {
	getGitBranch,
	getGitEmail,
	getGitOrganisation,
	getGitOriginUrl,
	getGitProject,
	getGitUsername,
} from './get-git.js'
import {
	getNodeMaximumCurrentVersion,
	getNodeMinimumCurrentVersion,
	isNodeCurrentVersion,
	getNodeVersions,
	getNodeCurrentVersions,
	isNodeMaximumCurrentVersion,
} from './get-node.js'
import {
	getPackageAuthor,
	getPackageBinEntry,
	getPackageBinExecutable,
	getPackageNodeEntry,
	getPackageBrowserEntry,
	getPackageDescription,
	getPackageFlowtypeDependency,
	getPackageKeywords,
	getPackageIndexEntry,
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
	isPackageTypeScript,
	isSourceModule,
} from './package.js'
import { getNowAliases, getNowName } from './website.js'

// ====================================
// Questions

export async function getQuestions(state) {
	const { packageData, nowData } = state
	const browsers = getPackageProperty(packageData, 'browsers')
	const browser = Boolean(
		browsers || getPackageProperty(packageData, 'browser')
	)
	const browsersList = typeof browsers === 'string' ? browsers : 'defaults'
	const editioned = hasEditions(packageData)
	const nodeEngineVersion = getPackageNodeEngineVersion(packageData)
	const nodeMinimumCurrentVersion = await getNodeMinimumCurrentVersion()
	const nodeMaximumCurrentVersion = await getNodeMaximumCurrentVersion()
	const minimumSupportNodeVersion =
		nodeEngineVersion || nodeMinimumCurrentVersion
	const maximumSupportNodeVersion = allNodeVersions[allNodeVersions.length - 1]
	return [
		{
			name: 'name',
			message: 'What will be the package name?',
			validate: isSpecified,
			filter: trim,
			default: getPackageName(packageData) || pathUtil.basename(pwd),
		},
		{
			name: 'description',
			message: 'and the package description?',
			validate: isSpecified,
			filter: trim,
			default: getPackageDescription(packageData),
		},
		{
			name: 'keywords',
			message: 'What are some keywords to describe the project?',
			validate: isSpecified,
			filter: trim,
			default: getPackageKeywords(packageData),
			skip({ keywords }) {
				return keywords
			},
		},
		{
			name: 'repoUrl',
			message: 'What will the git URL be?',
			validate: isGitUrl,
			filter: trim,
			default: (await getGitOriginUrl()) || getPackageRepoUrl(packageData),
		},
		{
			name: 'githubSlug',
			message: 'What is the github repository slug?',
			skip: true,
			default({ repoUrl }) {
				return repoUrl && repoUrl.includes('github') ? repoToSlug(repoUrl) : ''
			},
		},
		{
			name: 'author',
			message: 'Who will the package author be?',
			validate: isSpecified,
			filter: trim,
			default:
				getPackageAuthor(packageData) ||
				`${new Date().getFullYear()}+ ${(await getGitUsername()) || 'name'} <${
					(await getGitEmail()) || 'email'
				}>`,
		},
		{
			name: 'organisation',
			message: 'What is the organisation username for the package?',
			default:
				(await getGitOrganisation()) || getPackageOrganisation(packageData),
		},
		{
			name: 'type',
			type: 'list',
			choices: ['package', 'website'],
			message: 'What type of project will this be?',
			validate: isSpecified,
			default: getProjectType(packageData, nowData),
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
				'external',
			],
			message: 'What type of website will this be?',
			default: getWebsiteType(packageData, nowData),
			when({ type }) {
				return type === 'website'
			},
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
			},
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
			},
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
			},
		},
		{
			name: 'deployTarget',
			message: 'For the static website, what is the deploy target?',
			validate: isSpecified,
			filter: trim,
			when({ staticDirectory, website }) {
				return staticDirectory && website === 'surge'
			},
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
			},
		},
		{
			name: 'nowName',
			message: 'What label should be used for the now site?',
			validate: isSpecified,
			filter: trim,
			default: getNowName(nowData) || (await getGitProject()),
			skip: getNowName(nowData),
			when({ nowWebsite }) {
				return nowWebsite
			},
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
			},
		},
		{
			// @todo this needs to be reworked
			// as in travis.js we also just check for my:deploy
			// and this is set to always skip, so is manually applied
			// yet it has a default value
			name: 'travisWebsite',
			type: 'confirm',
			message: 'Will it utilise a travis deploy script?',
			default({ website }) {
				return website === 'surge' || website === 'custom'
			},
			skip: true,
			when({ travisWebsite }) {
				return travisWebsite
			},
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
			},
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
			},
		},
		{
			name: 'packageManager',
			type: 'list',
			message: 'Which package manager to use?',
			choices: ['npm', 'yarn'],
			default: 'npm',
			// async default() {
			// 	// having a different package manager for dev and production is not feasible
			// 	// as npm scripts and dev commands are constantly overriding each other
			// 	const yarn = await isYARN()
			// 	const npm = await isNPM()
			// 	if (yarn && !npm) return 'yarn'
			// 	return 'npm'
			// },
		},
		{
			name: 'languages',
			type: 'checkbox',
			choices: allLanguages,
			message: 'What programming languages will the source code be written in?',
			validate: isSpecified,
			default({ website, nextWebsite }) {
				const types = [
					isES5(packageData) && 'es5',
					isPackageTypeScript(packageData) && 'typescript',
					isPackageJavaScript(packageData) && 'esnext',
					isPackageCoffee(packageData) && 'coffeescript',
					isPackageJSON(packageData) && 'json',
					(hasPackageDependency(packageData, 'react') || nextWebsite) &&
						'react',
					(hasPackageDependency(packageData, 'react') || nextWebsite) && 'jsx',
					website && 'html',
					website && 'css',
				]
				const typesString =
					types.filter((value) => value).join(' ') || 'typescript'
				return typesString.split(' ')
			},
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
			},
		},
		{
			name: 'tsconfig',
			message: 'What should the path of the tsconfig file be?',
			validate: isSpecified,
			filter: trim,
			default: 'tsconfig.json',
			ignore({ languages }) {
				return languages.includes('typescript') === false
			},
		},
		{
			name: 'sourceModule',
			type: 'confirm',
			message: 'Will the source code use ESM (import instead of require)?',
			default({ languages }) {
				return Boolean(
					languages.includes('typescript') ? true : isSourceModule(packageData)
				)
			},
			skip({ language }) {
				return language !== 'esnext'
			},
		},
		{
			name: 'targetModules',
			type: 'checkbox',
			message: 'Which module formats should we target?',
			validate: isSpecified,
			choices({ sourceModule, docpadPlugin }) {
				if (docpadPlugin) return ['require']
				if (sourceModule) return ['require', 'import']
				return ['require']
			},
			default(opts) {
				return this.choices(opts)
			},
			ignore({ website }) {
				return website
			},
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
			},
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
			},
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
			},
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
			},
		},
		{
			name: 'dom',
			type: 'confirm',
			message: 'Will you make use of any DOM APIs?',
			default: false,
			// @todo check the tsconfig for it in lib, or check keywords
			when({ browsers, tsconfig }) {
				return browsers && tsconfig
			},
		},
		{
			name: 'compileNode',
			type: 'confirm',
			message: 'Would you like to compile your source code for Node.js?',
			default: true,
			skip({ language }) {
				return ['typescript', 'coffeescript'].includes(language)
			},
			when({ website, language }) {
				return (
					!website &&
					['esnext', 'typescript', 'coffeescript'].includes(language)
				)
			},
		},
		{
			name: 'compilerNode',
			type: 'list',
			message: 'Which compiler to use for the Node.js editions?',
			validate: isSpecified,
			choices({ language }) {
				return language === 'typescript'
					? ['typescript', 'babel']
					: language === 'coffeescript'
					? ['babel', 'coffeescript']
					: ['babel']
			},
			default({ language }) {
				return language === 'typescript'
					? 'typescript'
					: language === 'coffeescript'
					? 'coffeescript'
					: 'babel'
			},
			when({ compileNode }) {
				return compileNode
			},
		},
		{
			name: 'compileBrowser',
			type: 'confirm',
			message: 'Would you like to compile your source code for web browsers?',
			default: true,
			skip({ language }) {
				return ['typescript', 'coffeescript'].includes(language)
			},
			when({ browser, language }) {
				return (
					browser && ['esnext', 'typescript', 'coffeescript'].includes(language)
				)
			},
		},
		{
			name: 'compilerBrowser',
			type: 'list',
			message: 'Which compiler to use for the browser edition?',
			validate: isSpecified,
			choices({ language }) {
				return language === 'typescript'
					? ['typescript', 'babel']
					: language === 'coffeescript'
					? ['babel', 'coffeescript']
					: ['babel']
			},
			default({ language }) {
				return language === 'typescript' ? 'typescript' : 'babel'
			},
			when({ compileBrowser }) {
				return compileBrowser
			},
		},
		{
			name: 'sourceDirectory',
			message: 'Which directory will the source code be located in?',
			validate: isSpecified,
			filter: trim,
			default: 'source',
			ignore({ website }) {
				return website
			},
		},
		{
			name: 'indexEntry',
			message: 'What is the default entry filename (without extension)?',
			validate: isSpecified, // @todo attempt to remove this
			filter: trim,
			default: (await getPackageIndexEntry(packageData)) || 'index',
			skip: editioned,
			ignore({ website }) {
				return website
			},
		},
		{
			name: 'nodeEntry',
			message:
				'What is the entry filename (without extension) to use for Node.js?',
			validate: isSpecified,
			filter: trim,
			async default({ indexEntry }) {
				return (await getPackageNodeEntry(packageData)) || indexEntry
			},
			skip: editioned,
			ignore({ website, indexEntry }) {
				return website && indexEntry
			},
		},
		{
			name: 'browserEntry',
			message:
				'What is the entry filename (without extension) to use for Web Browsers?',
			validate: isSpecified,
			filter: trim,
			async default({ indexEntry }) {
				return (await getPackageBrowserEntry()) || indexEntry
			},
			skip: editioned,
			when({ browser, indexEntry }) {
				return browser && indexEntry
			},
		},
		{
			name: 'testEntry',
			message:
				'What is the entry filename (without extension) to use for tests?',
			validate: isSpecified,
			filter: trim,
			default: getPackageTestEntry(packageData) || 'test',
			skip: editioned,
			ignore({ website }) {
				return website
			},
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
			},
		},
		{
			name: 'binEntry',
			message: 'What is the filename of the bin entry (without extension)?',
			validate: isSpecified,
			filter: trim,
			default: getPackageBinEntry(packageData) || 'bin',
			skip() {
				return getPackageBinEntry(packageData)
			},
			when({ bin }) {
				return bin
			},
		},
		{
			name: 'binExecutable',
			message: 'What is the name of the bin executable(s)?',
			validate: isSpecified,
			filter: trim,
			default({ name }) {
				return getPackageBinExecutable(packageData) || name
			},
			skip() {
				return getPackageBinExecutable(packageData)
			},
			when({ bin }) {
				return bin
			},
		},
		{
			// should be called currentNodeVersionsOnly, however due to b/c it remains as is
			name: 'ltsNodeOnly',
			arg: 'lts',
			message: `Change the minimum supported node version from ${nodeEngineVersion} to ${nodeMinimumCurrentVersion}`,
			type: 'confirm',
			async default() {
				return (
					!nodeEngineVersion || (await isNodeCurrentVersion(nodeEngineVersion))
				)
			},
			skip({ website, ltsNodeOnly }) {
				return website || ltsNodeOnly
			},
		},
		{
			name: 'desiredNodeVersion',
			message: 'What is the desired node version?',
			type: 'list',
			validate: isNumber,
			choices({ nowWebsite, targetModules, ltsNodeOnly }) {
				// https://vercel.com/docs/serverless-functions/supported-languages?query=node%20version#defined-node.js-version
				// https://vercel.com/docs/runtimes#official-runtimes/node-js/node-js-version
				if (nowWebsite) return ['12', '10']
				if (targetModules.join('') === 'import') return importNodeVersions
				if (ltsNodeOnly) return getNodeCurrentVersions()
				return getNodeVersions()
			},
			default({ nowWebsite }) {
				if (nowWebsite) return '12'
				return nodeMaximumCurrentVersion
			},
			async skip({ ltsNodeOnly, nowWebsite, targetModules }) {
				return ltsNodeOnly || nowWebsite || targetModules.join('') === 'import'
			},
		},
		{
			name: 'desiredNodeOnly',
			message: `Only support the desired node version?`,
			type: 'confirm',
			default({ website, targetModules }) {
				return Boolean(website) || targetModules.join('') === 'import'
			},
			skip({ desiredNodeOnly }) {
				return desiredNodeOnly
			},
		},
		{
			name: 'minimumSupportNodeVersion',
			message: 'What is the minimum node version for support?',
			type: 'list',
			validate: isNumber,
			choices({ desiredNodeOnly, desiredNodeVersion, ltsNodeOnly }) {
				if (desiredNodeOnly) return [desiredNodeVersion]
				if (ltsNodeOnly) return getNodeCurrentVersions()
				return getNodeVersions()
			},
			default({ desiredNodeOnly, ltsNodeOnly, desiredNodeVersion }) {
				if (desiredNodeOnly) return desiredNodeVersion
				if (ltsNodeOnly) return nodeMinimumCurrentVersion
				return minimumSupportNodeVersion
			},
			skip({ desiredNodeOnly, ltsNodeOnly }) {
				return desiredNodeOnly || ltsNodeOnly
			},
		},
		{
			name: 'maximumSupportNodeVersion',
			message: 'What is the maximum node version for support?',
			type: 'list',
			validate: isNumber,
			choices({ desiredNodeOnly, desiredNodeVersion, ltsNodeOnly }) {
				if (desiredNodeOnly) return [desiredNodeVersion]
				if (ltsNodeOnly) return getNodeCurrentVersions()
				return getNodeVersions()
			},
			default({ desiredNodeOnly, ltsNodeOnly, desiredNodeVersion }) {
				if (desiredNodeOnly) return desiredNodeVersion
				if (ltsNodeOnly) return nodeMaximumCurrentVersion
				return maximumSupportNodeVersion
			},
			skip({ desiredNodeOnly, ltsNodeOnly }) {
				return desiredNodeOnly || ltsNodeOnly
			},
		},
		{
			name: 'minimumTestNodeVersion',
			message: 'What is the minimum node version for testing?',
			type: 'list',
			validate: isNumber,
			choices({ desiredNodeOnly, desiredNodeVersion, ltsNodeOnly }) {
				if (desiredNodeOnly) return [desiredNodeVersion]
				if (ltsNodeOnly) return getNodeCurrentVersions()
				return getNodeVersions()
			},
			default({
				desiredNodeOnly,
				desiredNodeVersion,
				minimumSupportNodeVersion,
				language,
			}) {
				if (desiredNodeOnly || language === 'json') return desiredNodeVersion
				return minimumSupportNodeVersion
			},
			skip({ desiredNodeOnly, ltsNodeOnly, language }) {
				return desiredNodeOnly || ltsNodeOnly || language === 'json'
			},
		},
		{
			name: 'maximumTestNodeVersion',
			message: 'What is the maximum node version for testing?',
			type: 'list',
			validate: isNumber,
			choices({ desiredNodeOnly, desiredNodeVersion, ltsNodeOnly }) {
				if (desiredNodeOnly) return [desiredNodeVersion]
				if (ltsNodeOnly) return getNodeCurrentVersions()
				return getNodeVersions()
			},
			default({
				desiredNodeOnly,
				desiredNodeVersion,
				maximumSupportNodeVersion,
				language,
			}) {
				if (desiredNodeOnly || language === 'json') return desiredNodeVersion
				return maximumSupportNodeVersion
			},
			skip({ desiredNodeOnly, ltsNodeOnly, language }) {
				return desiredNodeOnly || ltsNodeOnly || language === 'json'
			},
		},
		{
			name: 'targets',
			type: 'checkbox',
			message: 'Which compile targets should be generated?',
			validate: isSpecified,
			async choices({
				compilerNode,
				desiredNodeVersion,
				maximumSupportNodeVersion,
				minimumSupportNodeVersion,
			}) {
				if (compilerNode === 'babel') {
					return uniq([
						desiredNodeVersion,
						maximumSupportNodeVersion,
						minimumSupportNodeVersion,
					])
				} else if (compilerNode === 'typescript') {
					if (await isNodeMaximumCurrentVersion(minimumSupportNodeVersion))
						return latestTypescriptTargets
					if (await isNodeCurrentVersion(minimumSupportNodeVersion))
						return ltsTypescriptTargets
					return allTypescriptTargets
				} else {
					// ignored compiler
					return []
				}
			},
			default(opts) {
				return this.choices(opts)
			},
			when({ compilerNode }) {
				return ['typescript', 'babel'].includes(compilerNode)
			},
		},
		{
			name: 'kava',
			type: 'confirm',
			message: "Use Bevry's testing tools?",
			default: true,
			ignore({ website, nowWebsite, docpadPlugin }) {
				return docpadPlugin || (website && !nowWebsite)
			},
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
			},
		},
		{
			name: 'cdnDeploymentStrategy',
			message:
				'Which CDN deployment strategy should be used for the project and its documentation?',
			choices: ['surge', 'bevry', 'none'],
			validate: isSpecified,
			default: defaults.bevryCDNToken
				? 'bevry'
				: defaults.surgeLogin
				? 'surge'
				: 'none',
			when({ docs }) {
				return docs
			},
		},
		{
			name: 'travisComToken',
			type: 'password',
			message:
				'If you wish to update travis, what is your token for travis-ci.com?\nYou can find it here: https://travis-ci.com/account/preferences',
			filter: trim,
			default: defaults.travisComToken,
			skip: defaults.travisComToken,
			ignore({ githubSlug }) {
				return !githubSlug
			},
		},
		{
			name: 'travisOrgToken',
			type: 'password',
			message:
				'If you wish to update travis, what is your token for travis-ci.org?\nYou can find it here: https://travis-ci.org/account/preferences',
			filter: trim,
			default: defaults.travisOrgToken,
			skip: defaults.travisOrgToken,
			ignore({ githubSlug }) {
				return !githubSlug
			},
		},
		{
			name: 'travisUpdateEnvironment',
			type: 'confirm',
			message:
				'Would you like to update the remote travis environment variables?',
			default({ travisComToken, travisOrgToken }) {
				return Boolean(travisComToken || travisOrgToken)
			},
			skip: true,
		},
		{
			name: 'deployBranch',
			message: 'For deploying the website, which branch should be deployed?',
			validate: isSpecified,
			filter: trim,
			default: (await getGitBranch()) || 'master',
			when({ travisUpdateEnvironment, travisWebsite }) {
				return travisUpdateEnvironment && travisWebsite
			},
		},
		{
			name: 'bevryCDNToken',
			type: 'password',
			message: 'What is your Bevry CDN Token?',
			validate: isSpecified,
			filter: trim,
			default: defaults.bevryCDNToken,
			skip: defaults.bevryCDNToken,
			when({ travisUpdateEnvironment, cdnDeploymentStrategy }) {
				return travisUpdateEnvironment && cdnDeploymentStrategy === 'bevry'
			},
		},
		{
			name: 'surgeLogin',
			message: 'What is your surge.sh username?',
			validate: isSpecified,
			filter: trim,
			default: defaults.surgeLogin,
			skip: defaults.surgeLogin,
			when({ travisUpdateEnvironment, cdnDeploymentStrategy, website }) {
				return (
					travisUpdateEnvironment &&
					(cdnDeploymentStrategy === 'surge' || website === 'surge')
				)
			},
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
			},
		},
		{
			name: 'npmAuthToken',
			type: 'password',
			message: 'What will be the npm auth token for releasing on travis?',
			validate: isSpecified,
			filter: trim,
			default: defaults.npmAuthToken,
			skip: defaults.npmAuthToken,
			when({ npm, cdnDeploymentStrategy }) {
				return npm || cdnDeploymentStrategy === 'bevry'
			},
		},
		{
			name: 'travisEmail',
			message: 'What email to use for travis notifications?',
			filter: trim,
			default: defaults.travisEmail || (await getGitEmail()),
			skip() {
				return defaults.travisEmail
			},
			when({ travisUpdateEnvironment }) {
				return travisUpdateEnvironment
			},
		},
	]
}

export async function getAnswers(state) {
	// Fetch
	const answers = await _getAnswers(
		await getQuestions(state),
		state.packageData && state.packageData.boundation
	)

	// Apply
	state.answers = answers
	answers.targets = answers.targets || []
	answers.keywords = new Set((answers.keywords || '').split(/,\s*/))

	// ensure we don't have a situation where node 14 is about to be released, but we only support node 13 and up
	if (answers.desiredNodeVersion && answers.maximumSupportNodeVersion) {
		if (answers.desiredNodeVersion > answers.maximumSupportNodeVersion) {
			console.log(
				'constrained desiredNodeVersion to the maximumSupportNodeVersion of',
				answers.maximumSupportNodeVersion
			)
			answers.desiredNodeVersion = answers.maximumSupportNodeVersion
		}
	}

	// Return
	return answers
}
