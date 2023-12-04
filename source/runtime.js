// external
import sortObject from 'sortobject'
import versionCompare from 'version-compare'
import { unique, toggle, intersect } from '@bevry/list'
import { isAccessible } from '@bevry/fs-accessible'
import unlink from '@bevry/fs-unlink'
import write from '@bevry/fs-write'
import { fetchExclusiveCompatibleESVersionsForNodeVersions } from '@bevry/nodejs-ecmascript-compatibility'

// local
import { status } from './log.js'
import { bustedVersions, allLanguages, allTypescriptTargets } from './data.js'
import { parse, exec, spawn } from './fs.js'
import { getPreviousVersion, getDuplicateDeps, trimEmpty } from './util.js'
import { readPackage, writePackage } from './package.js'
import {
	scaffoldEditions,
	updateEditionEntries,
	updateEditionFields,
} from './editions.js'
import { updateEngines } from './versions.js'

// Consts
const commands = {
	yarn: {
		add: ['yarn', 'add', '--ignore-engines'],
		install: ['yarn', 'install', '--ignore-engines'],
		upgrade: ['yarn', 'upgrade', '--ignore-engines'],
		uninstall: ['yarn', 'remove', '--ignore-engines'],
		pnp: ['yarn', '--pnp', '--ignore-engines'],
		disablepnp: ['yarn', '--disable-pnp', '--ignore-engines'],
	},
	npm: {
		add: ['npm', 'install'],
		install: ['npm', 'install'],
		uninstall: ['npm', 'uninstall'],
	},
}

function isExact(value) {
	return value && value !== 'latest'
}
function latestDependencies(array, versions) {
	return array
		.filter((item) => !isExact(versions[item]))
		.map((item) => `${item}@latest`)
}
function exactDependencies(array, versions) {
	return array
		.filter((item) => isExact(versions[item]))
		.map((item) => `${item}@${versions[item]}`)
}
function uninstallRaw({ packageManager, packageData, dependencies }) {
	// only uninstall installed deps
	// for yarn this is necessary: https://github.com/yarnpkg/yarn/issues/6919
	// for npm this is useful
	dependencies = dependencies.filter(
		(dependency) =>
			packageData.dependencies[dependency] ||
			packageData.devDependencies[dependency],
	)
	if (!dependencies.length) return
	// continue
	const command = []
	const args = []
	if (packageManager === 'yarn') {
		args.push('--silent')
		command.push(...commands.yarn.uninstall)
	} else if (packageManager === 'npm') {
		command.push(...commands.npm.uninstall)
	} else {
		throw new Error('unsupported package manager')
	}
	command.push(...args, ...dependencies)
	console.log(command.join(' '))
	return spawn(command)
}
function uninstall({ packageManager, packageData, dependencies }) {
	return uninstallRaw({ packageManager, packageData, dependencies })
}
function installRaw({
	packageManager,
	packageData,
	dependencies,
	mode,
	exact = false,
}) {
	if (!dependencies.length) return
	const command = []
	const args = []
	if (packageManager === 'yarn') {
		args.push('--silent')
		// yarn add --help
		if (exact) args.push('--exact')
		if (mode === 'development') args.push('--dev')
		command.push(...commands.yarn.add)
	} else if (packageManager === 'npm') {
		args.push('--no-fund', '--no-audit')
		if (exact) args.push('--save-exact')
		args.push(mode === 'development' ? '--save-dev' : '--save-prod')
		command.push(...commands.npm.add)
	} else {
		throw new Error('unsupported package manager')
	}
	command.push(...args, ...dependencies)
	console.log(command.join(' '))
	return spawn(command)
}
async function install({
	packageManager,
	packageData,
	dependencies,
	mode,
	versions,
}) {
	// if yarn, uninstall first, workaround for https://github.com/yarnpkg/yarn/issues/5345
	if (packageManager === 'yarn')
		await uninstall({ packageManager, packageData, dependencies })
	// continue
	await installRaw({
		packageManager,
		packageData,
		dependencies: latestDependencies(dependencies, versions),
		mode,
	})
	await installRaw({
		packageManager,
		packageData,
		dependencies: exactDependencies(dependencies, versions),
		mode,
		exact: true,
	})
}

export function upgradePackageDependencies(exclude = []) {
	const args = ['npx', 'npm-check-updates', '-u']
	if (exclude.length) args.push('-x', exclude.join(','))
	return spawn(args)
}

export function peerDepInstallLocation(packageData, key) {
	return (packageData.peerDependencies || {})[key] ? 'dev' : true
}

// Update runtime
export async function updateRuntime(state) {
	const { answers, packageData, sourceEdition } = state

	// prepare
	const sourcePath =
		!answers.sourceDirectory || answers.sourceDirectory === '.'
			? `.`
			: `./${answers.sourceDirectory}`
	const mdx = answers.languages.includes('mdx')
	const run = [answers.packageManager, 'run']
	const test = [answers.packageManager, 'test']
	const extension = answers.language === 'typescript' ? '.ts' : '.js'

	// targets
	const allTargets = unique([...allTypescriptTargets, ...allLanguages]).map(
		(i) => i.toLowerCase(),
	)
	const usedTargets = unique([
		...answers.languages.map((i) => i.toLowerCase()),
		...state.activeEditions
			.map((e) =>
				Array.from(e.tags).find((t) => allTargets.includes(t.toLowerCase())),
			)
			.filter((i) => i)
			.map((i) => i.toLowerCase()),
	])

	// keywords
	toggle(answers.keywords, allTargets, false)
	toggle(answers.keywords, usedTargets, true)
	toggle(answers.keywords, 'website', answers.website)
	toggle(
		answers.keywords,
		'node',
		!answers.website && answers.npm && Boolean(answers.desiredNodeVersion),
	)
	toggle(answers.keywords, 'dom', answers.dom)
	toggle(answers.keywords, 'browser', answers.browser)
	toggle(answers.keywords, 'module', packageData.module)

	// log
	status('updating runtime...')

	// =================================
	// editions

	updateEditionFields(state)

	await scaffoldEditions(state)

	updateEditionEntries(state)

	// =================================
	// DEPENDENCIES TO WORK WITH

	// ensure dependencies exist for us to read and write to
	if (packageData.dependencies == null) {
		packageData.dependencies = {}
	}
	if (packageData.devDependencies == null) {
		packageData.devDependencies = {}
	}
	if (packageData.peerDependencies == null) {
		packageData.peerDependencies = {}
	}

	/** @type {Object.<string, boolean | 'dev'>} */
	const packages = {
		projectz: 'dev',
		'assert-helpers': false,
		joe: false,
		kava: false,
		'joe-examples': false,
		'joe-reporter-console': false,
		'joe-reporter-list': false,
		editions: state.useEditionsAutoloader,
		surge: false,
		vercel: false,
		now: false,
		next: false,
		'@zeit/next-typescript': false,
		'@zeit/next-mdx': false,
		'next-server': false,
		'@types/next': false,
		'@types/react': false,
		'@types/react-dom': false,
		'babel-cli': false,
		'babel-core': false,
		'babel-preset-es2015': false,
		'babel-preset-env': false,
		'@babel/cli': false,
		'@babel/core': false,
		'@babel/preset-env': false,
		'@babel/preset-typescript': false,
		'@babel/plugin-proposal-class-properties': false,
		'@babel/plugin-proposal-object-rest-spread': false,
		'@babel/plugin-proposal-optional-chaining': false,
		'babel-plugin-add-module-exports': false,
		typescript: false,
		'make-deno-edition': false,
		'typescript-eslint-parser': false,
		'@typescript-eslint/parser': false,
		prettier: false,
		eslint: false,
		'babel-eslint': false,
		'eslint-config-bevry': false,
		'eslint-config-prettier': false,
		'eslint-plugin-flow-vars': false,
		'eslint-plugin-prettier': false,
		'eslint-plugin-react-hooks': false,
		'eslint-plugin-react': false,
		'eslint-plugin-typescript': false,
		'@typescript-eslint/eslint-plugin': false,
		'valid-directory': false,
		'valid-module': false,
		documentation: false,
		jsdoc: false,
		minami: false,
		typedoc: false,
		'flow-bin': false,
		'coffee-script': false,
		yuidocjs: false,
		biscotto: false,
		'docpad-baseplugin': false,
		'docpad-plugintester': false,
		stylelint: false,
		'stylelint-config-standard': false,
		coffeelint: false,
		coffeescript:
			packageData.devDependencies.coffeescript ||
			packageData.devDependencies['coffee-script']
				? 'dev'
				: packageData.dependencies.coffeescript ||
				    packageData.dependencies['coffee-script']
				  ? true
				  : answers.languages === 'coffeescript'
				    ? 'dev'
				    : false,
	}

	// =================================
	// VERSIONS

	// Override the versions that are installed if these dependencies are needed
	/** @type {Object.<string, number | string>} */
	const versions = {}

	// apply busted version fixes
	for (const [key, version] of Object.entries(bustedVersions)) {
		versions[key] = getPreviousVersion(version, 0, 2)
	}

	// fix deps that are in deps and devDeps
	let duplicateDepNames = getDuplicateDeps(packageData)
	if (duplicateDepNames.length) {
		console.log(
			`the following dependencies existed in both deps and devDeps:`,
			duplicateDepNames,
		)
		// continue backtracking until we find a version that doesn't have the issue
		let cmd,
			out,
			version = packageData.version
		while (true) {
			// prepare
			const nextVersion = getPreviousVersion(version, 0, 1)
			if (version === nextVersion) {
				throw new Error(
					`unable to rever to a previous version that did not have duplicate packages, please fix the duplication of the following packages manually: ${duplicateDepNames.join(
						', ',
					)}`,
				)
			}
			version = nextVersion
			// dev deps
			cmd = `npm view --json --no-color ${packageData.name}@${version} devDependencies`
			out = (await exec(cmd)).trim()
			if (!out) {
				// continue backwards, as there should definitely be dev deps, so this version failed
				continue
			}
			const devDeps = JSON.parse(out)
			packageData.devDependencies = devDeps
			console.log(`used [${cmd}] to restore devDeps to`, devDeps)
			// deps
			cmd = `npm view --json --no-color ${packageData.name}@${version} dependencies`
			out = (await exec(cmd)).trim()
			const deps = JSON.parse(out || '{}')
			packageData.dependencies = deps
			console.log(`used [${cmd}] to restore deps to`, deps)
			// if we solved the problem, then break
			duplicateDepNames = getDuplicateDeps(packageData)
			if (duplicateDepNames.length === 0) break
		}
	}

	// change all remaining package.json dependencies to tophats
	for (const [key, version] of Object.entries(packageData.dependencies)) {
		if (/^\d/.test(version)) {
			packageData.dependencies[key] = '^' + version
		}
	}
	for (const [key, version] of Object.entries(packageData.devDependencies)) {
		if (/^\d/.test(version)) {
			packageData.devDependencies[key] = '^' + version
		}
	}

	// dependency compatibility for legacy node versions
	// lazy-require: v4 is >=10, v3 is >=8, v2 is >=0.10
	//               extract-opts, safeps dep ... only docpad uses it
	// safefs: v8 is >=4, v5 is >=8, v4 is >=0.12
	//         graceful-fs as only dep
	// safeps: v11 is >=4, 9 is >=8, 8 is >=0.12, 7 is >=0.8
	//         extract-opts dep, safefs dep
	// taskgroup: v6 is >=8, 5 is >=0.8
	// cson: v6 is node >=8, 5 is >=0.14
	//      has many deps
	// semver: v5 is >=10, 4 >=4
	//         should use version-range or version-compare instead
	// rimraf: 2,
	// kava: v7 is >=4, v4 is >=8, v3 is >=0.12
	// '@bevry/ansi': v6 is >=4
	// errlop: v7 is >=4
	// assert-helpers: needs 'process' module, which is node 4 and up
	// editions: v4 was last to support node <4
	//           https://github.com/bevry/editions/blob/master/HISTORY.md#v500-2020-october-27
	if (versionCompare(answers.nodeVersionSupportedMinimum, 8) === -1) {
		const dependencyCompat = {
			'cli-spinners': 1,
			'lazy-require': 2,
		}
		for (const [key, value] of Object.entries(dependencyCompat)) {
			versions[key] = value
		}
	}
	// if (versionCompare(answers.nodeVersionTestedMinimum, 8) === -1) {
	// 	const devDependencyCompat = {}
	// 	for (const [key, value] of Object.entries(devDependencyCompat)) {
	// 		versions[key] = value
	// 	}
	// }

	// brand new typescript version workaround for incompat with typedoc version
	// https://github.com/TypeStrong/typedoc/releases
	versions.typescript = '~5.3'

	// add user overrides
	Object.assign(
		versions,
		(packageData &&
			packageData.boundation &&
			packageData.boundation.versions) ||
			{},
	)

	// write the updated package.json file
	await writePackage(state)

	// =================================
	// scripts and dependencies

	// add our default scripts
	state.scripts = {
		'our:setup:install': commands[answers.packageManager].install.join(' '),
		'our:clean': 'rm -rf ./docs ./edition* ./es2015 ./es5 ./out ./.next',
		'our:meta:projectz':
			packageData.name === 'projectz'
				? 'npm run our:bin -- compile'
				: 'projectz compile',
		'our:test': [[...run, 'our:verify'], test]
			.map((i) => i.join(' '))
			.join(' && '),
		'our:release:prepare': [
			[...run, 'our:clean'],
			[...run, 'our:compile'],
			[...run, 'our:test'],
			[...run, 'our:meta'],
		]
			.map((i) => i.join(' '))
			.join(' && '),
		'our:release:push': 'git push origin && git push origin --tags',
		'our:release': [...run, 'our:release:push'].join(' '),
	}

	// add bin script
	if (packageData.bin) {
		state.scripts['our:bin'] = `node ./${packageData.bin}`
	}

	// add test script
	if (state.test) {
		state.scripts.test = `node ./${state.test}`
	}

	// add our package scripts
	if (answers.npm)
		Object.assign(state.scripts, {
			'our:release:check-changelog': `cat ./HISTORY.md | grep "v$npm_package_version" || (printf '%s\n' "add a changelog entry for v$npm_package_version" && exit -1)`,
			'our:release:check-dirty': 'git diff --exit-code',
			'our:release:tag': `export MESSAGE=$(cat ./HISTORY.md | sed -n "/## v$npm_package_version/,/##/p" | sed 's/## //' | awk 'NR>1{print buf}{buf = $0}') && test "$MESSAGE" || (printf '%s\n' 'proper changelog entry not found' && exit -1) && git tag "v$npm_package_version" -am "$MESSAGE"`,
			'our:release:push': 'git push origin && git push origin --tags',
			'our:release': [
				[...run, 'our:release:prepare'],
				[...run, 'our:release:check-changelog'],
				[...run, 'our:release:check-dirty'],
				[...run, 'our:release:tag'],
				[...run, 'our:release:push'],
			]
				.map((i) => i.join(' '))
				.join(' && '),
		})

	// docpad
	if (answers.name === 'docpad') {
		packages['docpad-baseplugin'] = true
	}
	// docpad plugin
	else if (answers.docpadPlugin) {
		packages['docpad-baseplugin'] = true
		packages['docpad-plugintester'] = packages.docpad = 'dev'
		state.scripts['our:setup:dpt'] = 'cd test && npm install && cd ..'
		state.scripts.test = 'docpad-plugintester'
		// this is needed for https://github.com/bevry/pluginclerk to resolve the correct plugin version for the docpad version
		packageData.peerDependencies.docpad = '^6.82.0'
	}
	// docpad website
	else if (answers.docpadWebsite) {
		packages.docpad = true
		state.scripts.test = 'docpad generate --env static'
	}

	// css
	if (answers.languages.includes('css')) {
		if (answers.vercelWebsite) {
			state.scripts['our:verify:stylelint'] =
				"printf '%s\n' 'disabled due to https://spectrum.chat/zeit/general/resolved-deployments-fail-with-enospc-no-space-left-on-device-write~d1b9f61a-65e8-42a3-9042-f9c6a6fae6fd'"
		} else {
			packages.stylelint = 'dev'
			packages['stylelint-config-prettier'] = packages[
				'stylelint-config-standard'
			] = 'dev'
			state.scripts['our:verify:stylelint'] = [
				'stylelint',
				'--fix',
				`'${sourcePath}/**/*.css'`,
			].join(' ')
			packageData.stylelint = {
				extends: [
					'stylelint-config-standard',
					'stylelint-prettier/recommended',
				],
				plugins: ['stylelint-prettier'],
				ignoreFiles: ['**/vendor/*.css', 'node_modules'],
			}
		}
	}

	// coffeescript
	if (answers.languages.includes('coffeescript')) {
		packages.coffeelint = 'dev'
		state.scripts['our:verify:coffeelint'] = ['coffeelint', sourcePath].join(
			' ',
		)
	}

	// javascript
	if (
		answers.languages.includes('esnext') ||
		answers.languages.includes('typescript')
	) {
		packages.eslint = 'dev'
	}

	// eslint
	if (packages.eslint) {
		packages.prettier =
			packages['eslint-config-prettier'] =
			packages['eslint-plugin-prettier'] =
				'dev'
		if (!packageData.eslintConfig) packageData.eslintConfig = {}
		if (answers.name === 'eslint-config-bevry') {
			packageData.eslintConfig.extends = ['./local.js']
		} else {
			packageData.eslintConfig.extends = ['bevry']
			packages['eslint-config-bevry'] = 'dev'
		}
		packageData.prettier = {
			semi: false,
			singleQuote: true,
			trailingComma: answers.keywords.has('es5') ? 'es5' : 'all',
		}
		state.scripts['our:verify:eslint'] = [
			'eslint',
			'--fix',
			"--ignore-pattern '**/*.d.ts'",
			"--ignore-pattern '**/vendor/'",
			"--ignore-pattern '**/node_modules/'",
			'--ext .mjs,.js,.jsx,.ts,.tsx',
			sourcePath,
		].join(' ')
	}

	// prettier
	if (packages.prettier) {
		state.scripts['our:verify:prettier'] = `prettier --write .`
	}

	// typescript
	// primarily typescript
	if (answers.language === 'typescript') {
		// @todo import make-deno-edition and use the api instead of the bin, so we can add/remove the keywords and script based on compatibility
		// @todo fix windows support for make-deno-edition
		if (answers.sourceModule && answers.npm && answers.keywords.has('deno')) {
			if (['make-deno-edition', '@bevry/figures'].includes(packageData.name)) {
				// @todo, once make-deno-edition API is used, this can be fixed
				// it is currently disabled because it cannot call itself during the compile step
				// as it has not finished compiling
				// state.scripts['our:compile:deno'] = 'npm run our:bin -- --attempt'
			} else {
				state.scripts['our:compile:deno'] = 'make-deno-edition --attempt'
				packages['make-deno-edition'] = 'dev'
			}
		}
	}
	// partially typescript
	if (answers.languages.includes('typescript')) {
		packages.typescript =
			packages['@typescript-eslint/eslint-plugin'] =
			packages['@typescript-eslint/parser'] =
				'dev'
		if (!packages['@types/node'] && answers.keywords.has('node')) {
			packages['@types/node'] = 'dev'
		}
	}

	// documentation
	if (answers.docs) {
		// Prepare
		const tools = []

		// typescript
		if (answers.languages.includes('typescript')) {
			tools.push('typedoc')
		}
		// coffeescript
		if (answers.languages.includes('coffescript')) {
			// biscotto
			if (packageData.devDependencies.biscotto) {
				tools.push('biscotto')
			}
			// yuidoc
			else {
				tools.push('yuidoc')
			}
		}
		// esnext
		if (answers.languages.includes('esnext')) {
			tools.push('jsdoc')
		}

		// Add the documentation engines
		tools.forEach(function (tool) {
			const out = tools.length === 1 ? './docs' : `./docs/${tool}`
			packages[tool] = 'dev'
			const parts = [`rm -rf ${out}`, '&&']
			switch (tool) {
				case 'typedoc':
					packages.typedoc = 'dev'
					parts.push(
						'typedoc',
						"--exclude '**/+(*test*|node_modules)'",
						'--excludeExternals',
						`--out ${out}`,
						sourcePath,
					)
					break
				case 'jsdoc':
					packages.jsdoc = 'dev'
					parts.push(
						'jsdoc',
						'--recurse',
						'--pedantic',
						'--access all',
						`--destination ${out}`,
						'--package ./package.json',
						'--readme ./README.md',
						sourcePath,
						'&&',
						`mv ${out}/$npm_package_name/$npm_package_version/* ${out}/`,
						'&&',
						`rm -rf ${out}/$npm_package_name/$npm_package_version`,
					)
					break
				case 'yuidoc':
					packages.yuidocjs = 'dev'
					parts.push(
						'yuidoc',
						`-o ${out}`,
						'--syntaxtype coffee',
						'-e .coffee',
						sourcePath,
					)
					break
				case 'biscotto':
					packages.biscotto = 'dev'
					parts.push(
						'biscotto',
						'-n "$npm_package_name"',
						'--title "$npm_package_name API Documentation"',
						'--readme README.md',
						`--output-dir ${out}`,
						sourcePath,
						'- LICENSE.md HISTORY.md',
					)
					break
				default:
					throw new Error('unknown documentation tool')
			}
			state.scripts[`our:meta:docs:${tool}`] = parts.filter((v) => v).join(' ')
		})
	}

	// flowtype
	if (answers.flowtype) {
		packages['eslint-plugin-flow-vars'] = packages['flow-bin'] = 'dev'
		state.scripts['our:verify:flow'] = 'flow check'
	}

	// edition deps
	for (const edition of state.activeEditions) {
		for (const dep of edition.dependencies) {
			packages[dep] = true
		}
		for (const devDep of edition.devDependencies) {
			packages[devDep] = 'dev'
		}
	}

	// deploy
	if (answers.website) {
		// surge
		if (answers.website === 'surge') {
			// packages.surge = 'dev' <-- not until https://github.com/sintaxi/surge/issues/504 is solved
			state.scripts['my:deploy'] =
				`npx --yes surge ./${answers.staticDirectory} ${answers.deployTarget}`
		}
		// vercel
		else if (answers.vercelWebsite) {
			packages.vercel = 'dev'
			// next / react
			if (answers.website.includes('next')) {
				Object.assign(state.scripts, {
					build: [...run, 'our:compile:next'].join(' '),
					'our:compile:next': 'next build',
					start: [
						[...run, 'our:verify'],
						['next', 'dev'],
					]
						.map((i) => i.join(' '))
						.join(' && '),
				})
				packages.next = 'dev'
				if (answers.languages.includes('typescript')) {
					packages['@types/next'] = 'dev'
				}
			}
		}
	}

	// react
	if (answers.languages.includes('react')) {
		packages.react = packages['react-dom'] = peerDepInstallLocation(
			packageData,
			'react',
		)
		packages['eslint-plugin-react-hooks'] = packages['eslint-plugin-react'] =
			'dev'
		if (answers.languages.includes('typescript')) {
			packages['@types/react'] = packages['@types/react-dom'] = packages.react
		}
	}

	// deploy: documentation
	if (answers.docs) {
		// packages.surge = 'dev' <-- not until https://github.com/sintaxi/surge/issues/504 is solved
	}

	// testing (not docpad plugin, nor website)
	if (answers.name === 'docpad-plugintester') {
		packages.editions = packages.kava = packages['assert-helpers'] = true
	} else if (answers.kava) {
		packages.kava = packages['assert-helpers'] = 'dev'
	}

	// package
	if (answers.npm) {
		if (answers.name !== '@bevry/update-contributors') {
			packages['@bevry/update-contributors'] = 'dev'
			state.scripts['our:meta:contributors'] = 'update-contributors'
		} else {
			state.scripts['our:meta:directory'] = 'npm run our:bin'
		}
		if (answers.name !== 'valid-directory') {
			packages['valid-directory'] = 'dev'
			state.scripts['our:verify:directory'] = 'valid-directory'
		} else {
			// do not valid-directory, the valid-directory package
			// as it deliberately has invalid files in it
			// such that it tests can detect that it works
			// state.scripts['our:verify:directory'] = 'npm run our:bin'
		}
		if (packageData.module) {
			if (answers.name !== 'valid-module') {
				packages['valid-module'] = 'dev'
				state.scripts['our:verify:module'] = 'valid-module'
			} else {
				state.scripts['our:verify:module'] = 'npm run our:bin'
			}
		}
	}

	// keywords
	toggle(
		answers.keywords,
		['types', 'typed'],
		packageData.types || packages.jsdoc,
	)

	// special cases
	if (answers.name === 'docpad-plugin-babel') {
		packages['@babel/core'] =
			packages['@babel/preset-env'] =
			packages['@babel/preset-react'] =
				true
	}

	// deprecation: joe to kava
	if (
		sourcePath !== '.' &&
		answers.type === 'package' &&
		packageData.devDependencies.joe &&
		packageData.name !== 'kava'
	) {
		status('renaming joe to kava...')
		await exec(
			`bash -O nullglob -O globstar -c "sed -i '' -e 's/joe/kava/g' ${sourcePath}/**/*.*"`,
		)
		status('...renamed joe to kava')
	}

	// simple deprecations: if an old package name exists, change it to its new version
	const packageRewrites = {
		githubauthquerystring: 'githubauthreq',
		'types-cloudflare-worker': '@cloudflare/workers-types',
		'babel-core': '@babel/core',
		'babel-preset-env': '@babel/preset-env',
		'babel-preset-react': '@babel/preset-react',
	}
	for (const [from, to] of Object.entries(packageRewrites)) {
		if (packageData.dependencies[from]) {
			packages[to] = packages[from]
			packages[from] = false
		}
	}

	// remove self
	packages[packageData.name] = false

	// remove old scripts
	delete state.scripts['our:setup:docpad']

	// ensure specific versions are set
	for (const key of Object.keys(versions)) {
		if (packageData.dependencies[key]) {
			packages[key] = true
		}
		if (packageData.devDependencies[key]) {
			packages[key] = 'dev'
		}
	}

	// write the package.json file
	await writePackage(state)

	// handle the dependencies
	const addDependencies = Object.keys(packages).filter(
		(key) => packages[key] === true,
	)
	const addDevDependencies = Object.keys(packages).filter(
		(key) => packages[key] === 'dev',
	)
	const removeDependencies = Object.keys(packages).filter(
		(key) =>
			packages[key] === false &&
			(packageData.dependencies[key] || packageData.devDependencies[key]),
	)

	// tsconfig
	if (answers.tsconfig === 'tsconfig.json') {
		// based from
		// https://blogs.msdn.microsoft.com/typescript/2018/08/27/typescript-and-babel-7/
		// https://github.com/vercel/next-plugins/tree/master/packages/next-typescript
		// https://github.com/Microsoft/TypeScript/issues/29056#issuecomment-448386794
		// Only enable isolatedModules on TypeScript projects, as for JavaScript projects it will be incompatible with 'use strict'
		// resolveJsonModule seems to cause too many issues, so is disabled unless needed
		let tsconfig
		if (await isAccessible(answers.tsconfig)) {
			try {
				tsconfig = (await parse(answers.tsconfig)) || {}
			} catch (e) {
				console.error(`Failed to parse ${answers.tsconfig}:`, e)
			}
		}
		status('writing tsconfig file...')

		// ensure necessary properties exist so we don't crash
		if (tsconfig.compilerOptions == null) tsconfig.compilerOptions = {}
		if (tsconfig.compilerOptions.lib == null) tsconfig.compilerOptions.lib = []
		if (tsconfig.exclude == null) tsconfig.exclude = []

		// store lib
		const lib = new Set()
		// add anything with a dot back to lib
		tsconfig.compilerOptions.lib
			.filter((i) => i.includes('.'))
			.forEach((i) => lib.add(i))
		if (answers.keywords.has('webworker')) lib.add('WebWorker')
		if (answers.keywords.has('dom')) lib.add('DOM').add('DOM.Iterable')
		if (answers.keywords.has('esnext')) lib.add('ESNext')

		// store include
		const include = new Set()
		tsconfig.include.forEach((i) => include.add(i))

		// store exclude
		const exclude = new Set()
		tsconfig.exclude.forEach((i) => exclude.add(i))
		if (answers.website) exclude.add('node_modules')

		// target
		const typescriptTarget = intersect(
			allTypescriptTargets,
			await fetchExclusiveCompatibleESVersionsForNodeVersions([
				answers.desiredNodeVersion,
			]),
		)[0]

		// compiler options
		Object.assign(tsconfig.compilerOptions, {
			allowJs: true,
			downlevelIteration: answers.keywords.has('es5') ? true : null,
			esModuleInterop: true,
			maxNodeModuleJsDepth: 5,
			moduleResolution: 'Node',
			strict: true,
			target: typescriptTarget,
		})
		if (answers.website) {
			// website
			Object.assign(tsconfig.compilerOptions, {
				allowSyntheticDefaultImports: true,
				forceConsistentCasingInFileNames: true,
				isolatedModules: true,
				jsx: 'preserve',
				module: 'ESNext',
				noEmit: true,
				resolveJsonModule: true,
				sourceMap: true,
			})
			include.add(
				'components',
				'pages',
				'public',
				'lib',
				answers.staticDirectory,
			)
		} else {
			// package
			Object.assign(tsconfig.compilerOptions, {
				isolatedModules: answers.language === 'typescript',
				module: answers.sourceModule ? 'ESNext' : null,
			})
			include.add(answers.sourceDirectory)
		}

		// re-adjust custom properties
		if (lib.size) tsconfig.compilerOptions.lib = Array.from(lib.values())
		if (include.size) tsconfig.include = Array.from(include.values())
		if (exclude.size) tsconfig.exclude = Array.from(exclude.values())

		// write
		await write(
			'tsconfig.json',
			JSON.stringify(sortObject(trimEmpty(tsconfig)), null, '  ') + '\n',
		)
		status('...wrote tsconfig file')
	} else {
		// remove tsconfig.json
		unlink('tsconfig.json')
	}

	// next mdx website
	if (answers.website && answers.website.includes('next')) {
		// add directories
		await spawn(['mkdir', '-p', 'components', 'pages/api', 'public', 'lib'])
		// add next.config.js
		if (!(await isAccessible('next.config.js'))) {
			const nextConfigContent =
				[
					mdx ? `const withMDX = require('@zeit/next-mdx')` : '',
					`module.exports = ${mdx ? 'withMDX(' : ''}{`,
					`	target: 'serverless'`,
					`}${mdx ? ')' : ''}`,
				]
					.filter((i) => i)
					.join('\n') + '\n'
			await write('next.config.js', nextConfigContent)
		}
		// add index page
		if (!(await isAccessible(`pages/index${extension}`))) {
			const indexPageContent =
				[
					`import React from 'react'`,
					`function IndexPage() { return <article>hello</article> }`,
					`export default IndexPage`,
				]
					.filter((i) => i)
					.join('\n') + '\n'
			await write(`pages/index${extension}`, indexPageContent)
		}
	}

	// remove deps
	if (removeDependencies.length) {
		status('remove old dependencies...')
		await uninstall({
			packageManager: answers.packageManager,
			packageData,
			dependencies: removeDependencies,
		})
		status('...removed old dependencies')
	}

	// status('yarn enabling plug and play...')
	// await spawn(commands.yarn.pnp)
	// status('...yarn enabled plug and play')

	// upgrade deps
	status('upgrading the installed dependencies...')
	// npx -p npm-check-updates takes 14 seconds each time, so install globally instead
	await upgradePackageDependencies(Object.keys(versions))
	// yarn still needs ncu to update package.json
	if (answers.packageManager === 'yarn') {
		await spawn(commands.yarn.install) // necessary to proceed
		await spawn(commands.yarn.upgrade) // updates the lock file
	}
	status('...upgraded the installed dependencies')

	// add deps
	if (addDependencies.length) {
		status('adding the dependencies...')
		await install({
			packageManager: answers.packageManager,
			packageData,
			dependencies: addDependencies,
			mode: 'production',
			versions,
		})
		status('...added the dependencies')
	}

	// add dev deps
	if (addDevDependencies.length) {
		status('adding the development dependencies...')
		await install({
			packageManager: answers.packageManager,
			packageData,
			dependencies: addDevDependencies,
			mode: 'development',
			versions,
		})
		status('...added the development dependencies')
	}

	// disable yarn pnp for vercel
	if (answers.packageManager === 'yarn' && answers.vercelWebsite) {
		status('yarn disabling plug and play...')
		await spawn(commands.yarn.disablepnp)
		status('...yarn disabled plug and play')
	}

	// run any extra setup steps
	status('running setup...')
	await spawn([...run, 'our:setup'])
	status('...ran setup')

	// read the updated package.json file
	await readPackage(state)

	// clean old editions to ensure new ones are compiled, do it only initially, not on recompiles
	if (!state.cleaned) {
		status('running clean...')
		await spawn([...run, 'our:clean'])
		state.cleaned = true
		status('...ran clean')
	}

	// continue
	if (answers.language !== 'json') {
		// determine which editions are necessary and which engines are supported
		status('update engines...')
		await updateEngines(state)
		status('...updated engines')
	}

	// ensure it has correct permissions, necessary for yarn publishing
	// as after runtime, as now everything is compiled and settled
	// so we can guarantee the bin file exists in the right place
	if (packageData.bin) {
		status('ensure correct bin permission...')
		const bins = (
			typeof packageData.bin === 'string'
				? [packageData.bin]
				: Object.values(packageData.bin)
		).map((i) => `./${i}`)
		await spawn(['chmod', '+x', ...bins])
		status('...ensured correct bin permission')
	}

	// log
	status('...updated runtime')
}
