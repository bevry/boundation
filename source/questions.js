// builtin
import * as pathUtil from 'path'

// external
import { unique, last, first } from '@bevry/list'
import {
	filterNodeVersions,
	filterSignificantNodeVersions,
	isNodeVersionActiveOrCurrent,
} from '@bevry/nodejs-versions'
import { fetchExclusiveCompatibleESVersionsForNodeVersions } from '@bevry/nodejs-ecmascript-compatibility'

// local
import _getAnswers from './answers.js'
import { pwd, allLanguages } from './data.js'
import {
	isNumber,
	isGitUrl,
	isSpecified,
	trim,
	repoToSlug,
	hasScript,
} from './util.js'
import {
	getGitEmail,
	getGitOrganisation,
	getGitOriginUrl,
	getGitProject,
	getGitUsername,
} from './get-git.js'
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
import { getVercelAliases, getVercelName } from './website.js'
import versionCompare from 'version-compare'

// ====================================
// Questions

export async function getQuestions(state) {
	const { packageData, vercelConfig } = state
	const browsers = getPackageProperty(packageData, 'browsers')
	const browser = Boolean(
		browsers || getPackageProperty(packageData, 'browser')
	)
	const browsersList = typeof browsers === 'string' ? browsers : 'defaults'
	const editioned = hasEditions(packageData)
	const nodeEngineVersion = getPackageNodeEngineVersion(packageData)
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
			default: getProjectType(packageData, vercelConfig),
		},
		{
			name: 'website',
			type: 'list',
			choices: [
				'vercel: next.js',
				'vercel: docpad',
				'vercel: static',
				'vercel: custom',
				'surge',
				'custom',
				'external',
			],
			message: 'What type of website will this be?',
			default: getWebsiteType(packageData, vercelConfig),
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
			name: 'vercelWebsite',
			type: 'confirm',
			message: 'Will it be a Vercel website?',
			default({ website }) {
				return Boolean(website && website.includes('vercel'))
			},
			skip: true,
			when({ vercelWebsite }) {
				return vercelWebsite
			},
		},
		{
			name: 'vercelName',
			message: 'What label should be used for the site?',
			validate: isSpecified,
			filter: trim,
			default: getVercelName(vercelConfig) || (await getGitProject()),
			skip: getVercelName(vercelConfig),
			when({ vercelWebsite }) {
				return vercelWebsite
			},
		},
		{
			name: 'vercelAliases',
			message: 'What aliases should be used for the site?',
			filter: trim,
			default: getVercelAliases(vercelConfig).join(', '),
			skip({ vercelAliases }) {
				return vercelAliases
			},
			when({ vercelWebsite }) {
				return vercelWebsite
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
			name: 'targetModules',
			type: 'checkbox',
			message: 'Which module formats should we target?',
			validate: isSpecified,
			choices({ sourceModule, docpadPlugin, compileNode, compileBrowser }) {
				if (docpadPlugin) return ['require']
				if (sourceModule) {
					if (compileNode || compileBrowser) return ['require', 'import']
					return ['import']
				}
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
			name: 'desiredNodeOnly',
			message: `Should we only support the most desired node version?`,
			type: 'confirm',
			default({ website }) {
				return Boolean(website)
			},
		},
		{
			name: 'nodeVersions',
			message:
				'Automated property to provide node versions for the upcoming questions',
			type: 'checkbox',
			validate: isSpecified,
			choices({ vercelWebsite, targetModules }) {
				// use released flag just in case something ever changes
				if (vercelWebsite)
					return filterSignificantNodeVersions({ released: true, vercel: true })
				if (targetModules.join('') === 'import')
					return filterSignificantNodeVersions({
						released: true,
						maintainedOrLTS: true,
						esm: true,
					})
				return filterSignificantNodeVersions({
					released: true,
					maintainedOrLTS: true,
				})
			},
			async default(opts) {
				const choices = await this.choices(opts)
				return choices
			},
			skip: true,
		},
		{
			name: 'desiredNodeVersion',
			message: 'What is the desired node version?',
			type: 'list',
			validate: isNumber,
			choices({ nodeVersions }) {
				return nodeVersions
			},
			default({ nodeVersions }) {
				// prefer the active LTS
				const preference = last(
					filterNodeVersions(nodeVersions, { active: true })
				)
				if (preference) return preference
				// otherwise fallback to the latest preselected
				return last(nodeVersions)
			},
		},
		{
			name: 'nodeVersionsSupported',
			message: 'Which Node.js versions must your package support?',
			type: 'checkbox',
			validate: isSpecified,
			choices({ nodeVersions, desiredNodeOnly, desiredNodeVersion }) {
				if (desiredNodeOnly) return [desiredNodeVersion]
				if (
					nodeEngineVersion &&
					isNodeVersionActiveOrCurrent(nodeEngineVersion)
				) {
					return filterNodeVersions(nodeVersions, {
						activeOrCurrent: true,
						gte: nodeEngineVersion,
					})
				} else if (nodeEngineVersion) {
					return filterNodeVersions(nodeVersions, {
						gte: nodeEngineVersion,
					})
				} else {
					return filterNodeVersions(nodeVersions, {
						maintained: true,
					})
				}
			},
			default(opts) {
				return this.choices(opts)
			},
		},
		{
			name: 'nodeVersionSupportedMinimum',
			message:
				'Automated property for the minimum node version to be supported',
			type: 'list',
			validate: isNumber,
			choices({ nodeVersionsSupported }) {
				return nodeVersionsSupported
			},
			default(opts) {
				return first(this.choices(opts))
			},
			skip: true,
		},
		{
			name: 'nodeVersionSupportedMaximum',
			message:
				'Automated property for the maximum node version to be supported support',
			type: 'list',
			validate: isNumber,
			choices({ nodeVersionsSupported }) {
				return nodeVersionsSupported
			},
			default(opts) {
				return last(this.choices(opts))
			},
			skip: true,
		},
		{
			name: 'nodeVersionsTestedRange',
			message:
				'Is there a semver range that you want to constrain test versions to?',
			filter: trim,
			skip({ desiredNodeOnly }) {
				return Boolean(desiredNodeOnly)
			},
		},
		{
			name: 'nodeVersionsTested',
			message: 'Automated property for providing the tested node versions',
			type: 'checkbox',
			validate: isSpecified,
			choices({
				nodeVersions,
				desiredNodeOnly,
				desiredNodeVersion,
				nodeVersionsTestedRange,
			}) {
				if (desiredNodeOnly) return [desiredNodeVersion]
				if (
					!nodeEngineVersion ||
					isNodeVersionActiveOrCurrent(nodeEngineVersion)
				) {
					return filterNodeVersions(nodeVersions, {
						maintained: true,
						range: nodeVersionsTestedRange,
					})
				} else {
					return filterNodeVersions(nodeVersions, {
						range: nodeVersionsTestedRange,
						gte: nodeEngineVersion,
					})
				}
			},
			default(opts) {
				return this.choices(opts)
			},
		},
		{
			name: 'nodeVersionTestedMinimum',
			message: 'Automated property for the minimum node version for testing',
			type: 'list',
			validate: isNumber,
			choices({ language, desiredNodeVersion, nodeVersionsTested }) {
				if (language === 'json') return [desiredNodeVersion]
				return nodeVersionsTested
			},
			default(opts) {
				return first(this.choices(opts))
			},
			skip: true,
		},
		{
			name: 'nodeVersionTestedMaximum',
			message: 'Automated property for the maximum node version for testing',
			type: 'list',
			validate: isNumber,
			choices({ language, desiredNodeVersion, nodeVersionsTested }) {
				if (language === 'json') return [desiredNodeVersion]
				return nodeVersionsTested
			},
			default(opts) {
				return last(this.choices(opts))
			},
			skip: true,
		},
		{
			name: 'targets',
			type: 'checkbox',
			message: 'Which compile targets should be generated?',
			validate: isSpecified,
			async choices({
				compilerNode,
				desiredNodeVersion,
				nodeVersionSupportedMinimum,
				nodeVersionSupportedMaximum,
				nodeVersionsSupported,
			}) {
				// ensure versions are in order of most preferred to least preferred
				// otherwise edition trimming will not work as expected
				return (
					compilerNode === 'babel'
						? unique([
								desiredNodeVersion,
								nodeVersionSupportedMinimum,
								nodeVersionSupportedMaximum,
						  ]).sort(versionCompare)
						: compilerNode === 'typescript'
						? await fetchExclusiveCompatibleESVersionsForNodeVersions(
								nodeVersionsSupported
						  )
						: []
				).reverse()
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
			ignore({ website, vercelWebsite, docpadPlugin }) {
				return docpadPlugin || (website && !vercelWebsite)
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
			name: 'deploymentStrategy',
			message:
				'Which deployment strategy should be used for the project and its documentation?',
			choices: ['surge', 'bevry', 'custom', 'none'],
			validate: isSpecified,
			default: hasScript(packageData.scripts, 'my:deploy') ? 'custom' : 'surge',
			when({ docs, website }) {
				return docs || website
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
	if (answers.desiredNodeVersion && answers.nodeVersionSupportedMaximum) {
		if (answers.desiredNodeVersion > answers.nodeVersionSupportedMaximum) {
			console.log(
				'constrained desiredNodeVersion to the nodeVersionSupportedMaximum of',
				answers.nodeVersionSupportedMaximum
			)
			answers.desiredNodeVersion = answers.nodeVersionSupportedMaximum
		}
	}

	// Return
	return answers
}
