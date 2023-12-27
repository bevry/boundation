// external
import * as typeChecker from 'typechecker'
import Fellow from 'fellow'

/** Delete the keys of the object which have empty values */
export function trimEmpty(obj, log = false, parents = []) {
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const keys = [...parents, key]
			const value = obj[key]
			if (typeChecker.isArray(value) && typeChecker.isEmptyArray(value)) {
				if (log) console.log('trim:', keys, value)
				delete obj[key]
			} else if (
				typeChecker.isPlainObject(value) &&
				typeChecker.isEmptyPlainObject(trimEmpty(value, log, keys))
			) {
				if (log) console.log('trim:', keys, value)
				delete obj[key]
			} else if (value == null || value === '') {
				if (log) console.log('trim:', keys, value)
				delete obj[key]
			}
		}
	}
	return obj
}

export function nodeMajorVersion(value) {
	if (typeof value === 'number') {
		value = String(value)
	} else if (typeof value !== 'string') {
		return null
	}
	return value.startsWith('0')
		? value.split('.').slice(0, 2).join('.')
		: value.split('.')[0]
}

export function nodeMajorVersions(array) {
	return array.map((version) => nodeMajorVersion(version))
}

/** Ensure that the suffix path does not start with the prefix directory path. */
export function unjoin(prefix, suffix) {
	if (!suffix) return null
	const start = prefix.endsWith('/') ? prefix : prefix + '/'
	const result = suffix.startsWith(start) ? suffix.substr(start.length) : start // @todo should be suffix?
	return result
}

/** Ensure that the suffix path starts with the prefix directory path. */
export function cojoin(prefix, suffix) {
	if (!suffix) return null
	const start = prefix.endsWith('/') ? prefix : prefix + '/'
	const result = suffix.startsWith(start) ? suffix : start + suffix
	return result
}

/** Is the value empty? */
export function isEmpty(value) {
	if (value == null) return true
	if (value === '') return true
	if (typeChecker.isPlainObject(value) && typeChecker.isEmptyPlainObject(value))
		return true
	return false
}

/** Set the property inside the object to the value, however if value is empty, delete the property instead. */
export function set(obj, key, value) {
	if (isEmpty(value)) delete obj[key]
	else obj[key] = value
}

/**
 * Get the import/require statement text
 * @returns an ESM import if `isESM` is truthy, otherwise a CJS require if `isESM` is falsey
 */
export function importOrRequire(left, right, isESM = true) {
	return isESM
		? `import ${left} from '${right}'`
		: `const ${left} = require('${right}')`
}

/**
 * Get the export statement text
 * @returns an ESM export if `isESM` is truthy, otherwise a CJS export if `isESM` is falsey
 */
export function exportOrExports(content, isESM = true) {
	return isESM ? `export default ${content}` : `module.exports = ${content}`
}

/** Get the `use strict` header text, but only if it is needed. */
export function useStrict(isESM = true) {
	return isESM ? '' : "'use strict'\n"
}

/** Get packages from both `dependencies` and `devDependencies` */
export function getAllDepNames(packageData) {
	if (!packageData.dependencies) packageData.dependencies = {}
	if (!packageData.devDependencies) packageData.devDependencies = {}
	const depNames = Object.keys(packageData.dependencies)
	const devDepNames = Object.keys(packageData.devDependencies)
	return depNames.concat(devDepNames)
}

/** Get packages that exist in both `dependencies` and `devDependencies` */
export function getDuplicateDeps(packageData) {
	const allDepNames = new Set(getAllDepNames(packageData))
	const duplicateDepNames = []
	for (const key of allDepNames) {
		if (packageData.devDependencies[key] && packageData.dependencies[key]) {
			duplicateDepNames.push(key)
		}
	}
	return duplicateDepNames
}

/** Decrement the version number by the specified arguments */
export function getPreviousVersion(version, major = 0, minor = 1) {
	const parts = String(version)
		.split('.')
		.map((i) => Number(i))
	if (major) {
		parts[0] -= major
		if (parts[0] < 0) parts[0] = 0
	}
	if (minor) {
		parts[1] -= minor
		if (parts[1] < 0) parts[1] = 0
	}
	return parts.join('.')
}

/** Fix typescript embedding the source directory inside the output */
export function fixTsc(editionDirectory, sourceDirectory) {
	return [
		'&&',
		'(', // begin fix
		`test ! -d ${editionDirectory}/${sourceDirectory}`,
		'||',
		'(', // begin move
		`mv ${editionDirectory}/${sourceDirectory} edition-temp`,
		`&& rm -rf ${editionDirectory}`,
		`&& mv edition-temp ${editionDirectory}`,
		`)`, // end move
		')', // end fix
	]
}

export function fixBevry(input) {
	const people = input
		.split(', ')
		.map((person) =>
			person
				.replace('Bevry Pty Ltd', 'Benjamin Lupton')
				.replace('<us@bevry.me>', '<b@lupton.cc>')
				.replace('://bevry.me', '://balupton.com'),
		)
		.join(', ')
	const fellows = Fellow.add(people)
	if (fellows.length === 1) {
		return fellows[0].toString({ displayYears: false }) // only one person, no need for the years
	}
}

export function fixBalupton(person) {
	return person
		.replace(
			/^Benjamin Lupton( <b@lupton.cc>)?$/,
			'Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)',
		)
		.replace(
			/^Benjamin Lupton( <b@lupton.cc>)? \(https?:\/\/github.com\/balupton\)$/,
			'Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)',
		)
		.replace(
			/^Benjamin Lupton( <b@lupton.cc>)? \(https?:\/\/balupton.com\/?\)$/,
			'Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)',
		)
}

/** Trim the organisation/scope name from the package name */
export function trimOrgName(str) {
	if (str[0] === '@') return str.split('/').slice(1).join('/')
	return str
}

/** Strip the object of the keys */
export function strip(obj, ...keys) {
	for (const key of keys) {
		delete obj[key]
	}
	return obj
}

export function addExtension(file, extension) {
	return file ? `${file}.${extension}` : file
}

/** Trim the string */
export function trim(input = '') {
	return input.trim()
}

export function slugit(input) {
	return (
		(input && input !== 'undefined' && input.replace(/[^a-zA-Z0-9.-]+/g, '')) ||
		''
	)
}

export function isSpecified(input) {
	return slugit(Array.isArray(input) ? input.join(' ') : input).length !== 0
}

/** Is the string representing a positive number? */
export function isNumber(input) {
	return /^[0-9.]+$/.test(input)
}

export function isGitUrl(input) {
	return /\.git$/.test(input)
}

export function repoToWebsite(input = '') {
	return input
		.replace(/\.git$/, '')
		.replace(/^(ssh[:/]+)?git@github\.com[:/]*/, 'https://github.com/')
}

export function repoToSlug(input = '') {
	return (
		(input && input.replace(/\.git$/, '').replace(/^.+?\.com[:/]*/, '')) || ''
	)
}

export function repoToOrganisation(input = '') {
	return (input && repoToSlug(input).split('/')[0]) || ''
}

export function repoToProject(input = '') {
	return (input && repoToSlug(input).split('/')[1]) || ''
}

export const defaultScript = "printf '%s\n' 'no need for this project'"

export const defaultDeploy =
	'npm run our:compile && npm run our:test && npm run our:deploy'

export function hasScript(scripts, name) {
	return scripts && scripts[name] && scripts[name] !== defaultScript
}

export function ensureScript(scripts, name) {
	if (scripts && !scripts[name]) scripts[name] = defaultScript
}
