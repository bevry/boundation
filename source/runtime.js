// External
import * as pathUtil from 'path'

// Local
import { status } from './log.js'
import { allEsTargets, allLanguages, bustedVersions, typesDir } from './data.js'
import { parse, exec, exists, spawn, unlink, write } from './fs.js'
import {
	uniq,
	toggle,
	fixTsc,
	getPreviousVersion,
	getDuplicateDeps,
	getAllDepNames,
} from './util.js'
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
			packageData.devDependencies[dependency]
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

export async function upgradePackageDependencies(install) {
	try {
		return await spawn(['ncu', '-u'])
	} catch (err) {
		if (install) {
			return Promise.reject(err)
		} else {
			await spawn(['npm', 'i', '-g', 'npm-check-updates'])
			upgradePackageDependencies(true)
		}
	}
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

	// log
	status('updating runtime...')

	// =================================
	// editions

	updateEditionFields(state)

	await scaffoldEditions(state)

	updateEditionEntries(state)

	// =================================
	// DEPENDENCIES TO WORK WITH

	/** @type {Object.<string, boolean | 'dev'>} */
	const packages = {
		projectz: 'dev',
		'assert-helpers': false,
		joe: false,
		kava: false,
		'joe-examples': false,
		'joe-reporter-console': false,
		'joe-reporter-list': false,
		editions: state.useEditionAutoloader,
		surge: false,
		now: false,
		next: false,
		'@zeit/next-typescript': false,
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
	const versions = {
		// next: 'canary',
		// now: 'canary',
		// '@zeit/next-typescript': 'canary',
		// '@zeit/next-mdx': 'canary',
	}

	// apply busted version fixes
	for (const [key, version] of Object.entries(bustedVersions)) {
		versions[key] = getPreviousVersion(version, 0, 2)
	}

	// fix deps that are in deps and devDeps
	let duplicateDepNames = getDuplicateDeps(packageData)
	if (duplicateDepNames.length) {
		console.log(
			`the following dependencies existed in both deps and devDeps:`,
			duplicateDepNames
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
						', '
					)}`
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
	const dependencyCompat = {
		cson: 5,
		rimraf: 2,
		safefs: 4,
		safeps: 7,
		taskgroup: 5,
		'cli-spinners': 1,
		'lazy-require': 2,
	}
	const devDependencyCompat = {
		kava: 3,
		'assert-helpers': 4,
	}
	if (answers.minimumSupportNodeVersion < 8) {
		for (const [key, value] of Object.entries(dependencyCompat)) {
			versions[key] = value
		}
	}
	if (answers.minimumTestNodeVersion < 8) {
		for (const [key, value] of Object.entries(devDependencyCompat)) {
			versions[key] = value
		}
	}

	// add user overrides
	Object.assign(
		versions,
		(packageData &&
			packageData.boundation &&
			packageData.boundation.versions) ||
			{}
	)

	// write the updated package.json file
	await writePackage(state)

	// =================================
	// scripts and dependencies

	// add our default scripts
	state.scripts = {
		'our:setup:install': commands[answers.packageManager].install.join(' '),
		'our:clean': 'rm -Rf ./docs ./edition* ./es2015 ./es5 ./out ./.next',
		'our:meta:projectz':
			packageData.name === 'projectz' ? 'npx . compile' : 'projectz compile',
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
		'our:release:push': 'git push origin master && git push origin --tags',
		'our:release': [...run, 'our:release:push'].join(' '),
	}

	// add test script
	if (state.test) {
		state.scripts.test = `node ./${state.test}`
	}

	// add our package scripts
	if (answers.npm)
		Object.assign(state.scripts, {
			'our:release:check-changelog':
				'cat ./HISTORY.md | grep v$npm_package_version || (echo add a changelog entry for v$npm_package_version && exit -1)',
			'our:release:check-dirty': 'git diff --exit-code',
			'our:release:tag':
				'export MESSAGE=$(cat ./HISTORY.md | sed -n "/## v$npm_package_version/,/##/p" | sed \'s/## //\' | awk \'NR>1{print buf}{buf = $0}\') && test "$MESSAGE" || (echo \'proper changelog entry not found\' && exit -1) && git tag v$npm_package_version -am "$MESSAGE"',
			'our:release:push': 'git push origin master && git push origin --tags',
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

	// docpad plugin
	if (answers.name === 'docpad') {
		packages['docpad-baseplugin'] = true
	} else if (answers.docpadPlugin) {
		packages['docpad-baseplugin'] = true
		packages['docpad-plugintester'] = packages.docpad = 'dev'
		state.scripts.test = 'docpad-plugintester'
		if (packageData.peerDependencies) {
			// it is read later, @todo why?
			delete packageData.peerDependencies.docpad
		}
	}
	// docpad website
	else if (answers.docpadWebsite) {
		packages.docpad = true
		state.scripts.test = 'docpad generate --env static'
	}

	// css
	if (answers.languages.includes('css')) {
		if (answers.nowWebsite) {
			state.scripts['our:verify:stylelint'] =
				"echo 'disabled due to https://spectrum.chat/zeit/general/resolved-deployments-fail-with-enospc-no-space-left-on-device-write~d1b9f61a-65e8-42a3-9042-f9c6a6fae6fd'"
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
			' '
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
		packages.prettier = packages['eslint-config-prettier'] = packages[
			'eslint-plugin-prettier'
		] = 'dev'
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
		// @todo import make-deno-edition and use the api instead of the bin
		// deno compat layer
		if (answers.sourceModule && answers.npm) {
			if (packageData.name === 'make-deno-edition') {
				// @todo, once make-deno-edition API is used, this can be fixzed
				// it is currently disabled because it cannot call itself during the compile step
				// as it has not finished compiling
				// state.scripts['our:compile:deno'] = 'npx . --attempt'
			} else {
				state.scripts['our:compile:deno'] = 'make-deno-edition --attempt'
				packages['make-deno-edition'] = 'dev'
			}
		}
		// types
		state.scripts['our:compile:types'] = [
			'tsc',
			`--project ${answers.tsconfig}`,
			'--emitDeclarationOnly',
			'--declaration',
			'--declarationMap',
			`--declarationDir ./${typesDir}`,
			...fixTsc(typesDir, answers.sourceDirectory),
			// doesn't work: '|| true', // fixes failures where types may be temporarily missing
		]
			.filter((part) => part)
			.join(' ')
		state.typesDirectoryPath = packageData.types = `./${typesDir}/`
	} else {
		state.typesDirectoryPath = null
	}
	// partially typescript
	if (answers.languages.includes('typescript')) {
		packages.typescript = packages[
			'@typescript-eslint/eslint-plugin'
		] = packages['@typescript-eslint/parser'] = 'dev'
	}
	// not typescript
	else {
		// Types
		// define the possible locations
		// do note that they must exist throughout boundation, which if it is a compiled dir, is sporadic
		const typePaths = [
			// existing types directory
			packageData.types,
			// e.g. index.d.ts
			pathUtil.join(answers.indexEntry + '.d.ts'),
			// e.g. source/index.d.ts
			sourceEdition &&
				pathUtil.join(sourceEdition.directory, answers.indexEntry + '.d.ts'),
		].filter((v) => v)
		// fetch their existing status and convert back into the original location
		const typePathsExisting = await Promise.all(
			typePaths.map((v) => exists(v).then((e) => e && v))
		)
		// find the first location that exists
		const typePath = typePathsExisting.find((v) => v)
		// and if exists, apply to types
		if (typePath) {
			packageData.types = typePath
		} else {
			delete packageData.types
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
			const parts = [`rm -Rf ${out}`, '&&']
			switch (tool) {
				case 'typedoc':
					packages.typedoc = 'dev'
					parts.push(
						'typedoc',
						// use includeDeclarations if we are not a typescript project
						answers.language === 'typescript' ? '' : '--includeDeclarations',
						'--mode file',
						"--exclude '**/+(*test*|node_modules)'",
						'--excludeExternals',
						'--name "$npm_package_name"',
						'--readme ./README.md',
						`--out ${out}`,
						sourcePath
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
						`rm -Rf ${out}/$npm_package_name/$npm_package_version`
					)
					break
				case 'yuidoc':
					packages.yuidocjs = 'dev'
					parts.push(
						'yuidoc',
						`-o ${out}`,
						'--syntaxtype coffee',
						'-e .coffee',
						sourcePath
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
						'- LICENSE.md HISTORY.md'
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
			packages.surge = 'dev'
			state.scripts[
				'my:deploy'
			] = `surge ./${answers.staticDirectory} ${answers.deployTarget}`
		}
		// now
		else if (answers.nowWebsite) {
			packages.now = 'dev'
			// next / react
			if (answers.website.includes('next')) {
				Object.assign(state.scripts, {
					'now-build': [...run, 'our:compile:next'].join(' '),
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
			'react'
		)
		packages['eslint-plugin-react-hooks'] = packages['eslint-plugin-react'] =
			'dev'
		if (answers.languages.includes('typescript')) {
			packages['@types/react'] = packages['@types/react-dom'] = packages.react
		}
	}

	// deploy: documentation
	if (answers.docs) {
		packages.surge = 'dev'
	}

	// testing (not docpad plugin, nor website)
	if (answers.name === 'docpad-plugintester') {
		packages.kava = packages['assert-helpers'] = true
	} else if (answers.kava) {
		packages.kava = packages['assert-helpers'] = 'dev'
	}

	// package
	if (answers.npm) {
		if (answers.name !== '@bevry/update-contributors') {
			packages['@bevry/update-contributors'] = 'dev'
			state.scripts['our:meta:contributors'] = 'update-contributors'
		} else {
			state.scripts['our:meta:directory'] = 'npx .'
		}
		if (answers.name !== 'valid-directory') {
			packages['valid-directory'] = 'dev'
			state.scripts['our:verify:directory'] = 'valid-directory'
		} else {
			// do not valid-directory, the valid-directory package
			// as it deliberately has invalid files in it
			// such that it tests can detect that it works
			// state.scripts['our:verify:directory'] = 'npx .'
		}
		if (packageData.module) {
			if (answers.name !== 'valid-module') {
				packages['valid-module'] = 'dev'
				state.scripts['our:verify:module'] = 'valid-module'
			} else {
				state.scripts['our:verify:module'] = 'npx .'
			}
		}
	}

	// keywords
	const allLanguagesLowercase = allLanguages.map((i) => i.toLowerCase())
	const allEsTargetsLowercase = allEsTargets.map((i) => i.toLowerCase())
	const usedTargetsLowercase = state.activeEditions
		.map((e) =>
			Array.from(e.tags).find((t) =>
				allEsTargetsLowercase.includes(t.toLowerCase())
			)
		)
		.filter((i) => i)
		.map((i) => i.toLowerCase())
	const usedLanguagesLowercase = answers.languages.map((i) => i.toLowerCase())
	toggle(answers.keywords, allEsTargetsLowercase, false)
	toggle(answers.keywords, usedTargetsLowercase, true)
	toggle(answers.keywords, allLanguagesLowercase, false)
	toggle(answers.keywords, usedLanguagesLowercase, true)
	// console.log({ usedTargetsLowercase, usedLanguagesLowercase })
	toggle(answers.keywords, 'website', answers.website)
	toggle(
		answers.keywords,
		'node',
		!answers.website && answers.npm && Boolean(answers.desiredNodeVersion)
	)
	toggle(answers.keywords, 'dom', answers.dom)
	toggle(answers.keywords, 'browser', answers.browser)
	toggle(answers.keywords, 'module', packageData.module)
	toggle(
		answers.keywords,
		['types', 'typed'],
		packageData.types || packages.jsdoc
	)

	// githubauthquerystring to githubauthreq
	if (packageData.dependencies.githubauthquerystring) {
		packages.githubauthquerystring = false
		packages.githubauthreq = true
	}

	// special cases
	if (answers.name === 'docpad-plugin-babel') {
		packages['@babel/core'] = packages['@babel/preset-env'] = packages[
			'@babel/preset-react'
		] = true
		packages['babel-core'] = packages['babel-preset-env'] = packages[
			'babel-preset-react'
		] = false
	}

	// joe to kava
	if (
		sourcePath !== '.' &&
		answers.type === 'package' &&
		packageData.devDependencies.joe &&
		packageData.name !== 'kava'
	) {
		status('renaming joe to kava...')
		await exec(
			`bash -O nullglob -O globstar -c "sed -i '' -e 's/joe/kava/g' ${sourcePath}/**/*.*"`
		)
		status('...renamed joe to kava')
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
		(key) => packages[key] === true
	)
	const addDevDependencies = Object.keys(packages).filter(
		(key) => packages[key] === 'dev'
	)
	const removeDependencies = Object.keys(packages).filter(
		(key) =>
			packages[key] === false &&
			(packageData.dependencies[key] || packageData.devDependencies[key])
	)

	// tsconfig
	if (answers.tsconfig === 'tsconfig.json') {
		// based from
		// https://blogs.msdn.microsoft.com/typescript/2018/08/27/typescript-and-babel-7/
		// https://github.com/zeit/next-plugins/tree/master/packages/next-typescript
		// https://github.com/Microsoft/TypeScript/issues/29056#issuecomment-448386794
		// Only enable isolatedModules on TypeScript projects, as for JavaScript projects it will be incompatible with 'use strict'
		// resolveJsonModule seems to cause too many issues, so is disabled unless needed
		const lib = new Set()
		try {
			const data = await parse(answers.tsconfig)
			const list =
				(data && data.compilerOptions && data.compilerOptions.lib) || []
			// add any lib that has a dot back to lib
			list.filter((i) => i.includes('.')).forEach((i) => lib.add(i))
		} catch (e) {
			// ignore
		}
		status('writing tsconfig file...')
		if (answers.keywords.has('webworker')) lib.add('WebWorker')
		if (answers.keywords.has('dom')) lib.add('DOM').add('DOM.Iterable')
		if (answers.keywords.has('esnext')) lib.add('ESNext')
		const tsconfig = answers.website
			? {
					compilerOptions: {
						allowJs: true,
						allowSyntheticDefaultImports: true,
						jsx: 'preserve',
						lib: Array.from(lib),
						maxNodeModuleJsDepth: 5,
						module: 'ESNext',
						moduleResolution: 'Node',
						sourceMap: true,
						strict: true,
						target: 'ESNext',
						// new props
						skipLibCheck: true,
						forceConsistentCasingInFileNames: true,
						noEmit: true,
						esModuleInterop: true,
						resolveJsonModule: true,
						isolatedModules: true,
					},
					include: uniq([
						'components',
						'pages',
						'public',
						'lib',
						answers.staticDirectory,
					]),
					exclude: ['node_modules'],
			  }
			: {
					compilerOptions: Object.assign(
						{
							allowJs: true,
							esModuleInterop: true,
							isolatedModules: answers.language === 'typescript',
							maxNodeModuleJsDepth: 5,
							moduleResolution: 'Node',
							strict: true,
							target: 'ESNext',
							lib: Array.from(lib),
						},
						answers.sourceModule ? { module: 'ESNext' } : {}
					),
					include: [answers.sourceDirectory],
			  }
		if (lib.size === 0) delete tsconfig.compilerOptions.lib
		await write('tsconfig.json', JSON.stringify(tsconfig, null, '  ') + '\n')
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
		if (!(await exists('next.config.js'))) {
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
		if (!(await exists(`pages/index${extension}`))) {
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
	await upgradePackageDependencies()
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

	// disable yarn pnp for zeit
	if (answers.packageManager === 'yarn' && answers.nowWebsite) {
		status('yarn disabling plug and play...')
		await spawn(commands.yarn.disablepnp)
		status('...yarn disabled plug and play')
	}

	// run any extra setup steps
	status('running setup...')
	await spawn([...run, 'our:setup'])
	status('...ran setup')

	// run clean
	status('running clean...')
	await spawn([...run, 'our:clean'])
	status('...ran clean')

	// run compile
	status('running compile...')
	await spawn([...run, 'our:compile'])
	status('...ran compile')

	// read the updated package.json file
	await readPackage(state)

	// this will get written at a later point
	if (answers.docpadPlugin) {
		if (packageData.peerDependencies == null) {
			packageData.peerDependencies = {}
		}
		packageData.peerDependencies.docpad = '^6.82.0'
	}

	// continue
	if (answers.language !== 'json') {
		status('update engines...')
		await updateEngines(state)
		status('...updated engines')
	}

	// ensure it has correct permissions, necessary for yarn publishing
	// as after runtime, as now everything is compiled and settled
	// so we can guarantee the bin file exists in the right place
	if (packageData.bin) {
		status('ensure correct bin permission...')
		const bins = (typeof packageData.bin === 'string'
			? [packageData.bin]
			: Object.values(packageData.bin)
		).map((i) => `./${i}`)
		await spawn(['chmod', '+x', ...bins])
		status('...ensured correct bin permission')
	}

	// log
	status('...updated runtime')
}
