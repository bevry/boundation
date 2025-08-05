// external
import * as typeChecker from 'typechecker'
import Fellow from 'fellow'
import versionClean from 'version-clean'
import versionCompare from 'version-compare'

/**
 * Convert the input to an array if it isn't already, if it is nullable, make it an empty erray.
 * @param {any} input The input to convert.
 * @returns {any[]} The result array.
 */
export function ensureArray(input) {
	if (Array.isArray(input)) {
		return input
	} else if (input != null) {
		return [input]
	} else {
		return []
	}
}

/**
 * Convert input to lowercase string
 * @param {string|string[]} input - input string to convert to lowercase
 * @returns {string|string[]} lowercase version of the input string
 */
export function toLowerCase(input) {
	if (Array.isArray(input)) {
		return input.map((i) => toLowerCase(i))
	} else if (typeof input === 'string') {
		return input.toLowerCase()
	} else {
		console.error({ input })
		throw new TypeError('Expected input to be a string')
	}
}

/**
 * Get the highest TypeScript version required by TypeDoc
 * @returns {Promise<string>} Promise that resolves to the TypeScript version
 */
export async function getTypedocTypescriptVersion() {
	const response = await fetch('https://unpkg.com/typedoc/package.json')
	const data = await response.json()
	const range = data.peerDependencies.typescript
	const version = range
		.split('||')
		.map(versionClean)
		.sort(versionCompare)
		.slice(-1)[0]
	return version
}

/**
 * Extract major version from a Node.js version string
 * @param {string|number} version - Node.js version string or number
 * @returns {string|null} Major version string or null if invalid
 */
export function nodeMajorVersion(version) {
	if (typeof version !== 'string' && typeof version !== 'number') {
		return null
	} else {
		version = versionClean(version)
	}
	return version.startsWith('0')
		? version.split('.').slice(0, 2).join('.')
		: version.split('.')[0]
}

/**
 * Convert array of Node.js versions to their major versions
 * @param {string[]|string|number} [versions] - Array or String of Node.js version strings, if string, split by '||'
 * @returns {string[]} Array of major version strings
 */
export function nodeMajorVersions(versions = []) {
	if (typeof versions === 'number') {
		versions = String(versions)
	}
	if (typeof versions === 'string') {
		versions = versions.split('||')
	}
	if (Array.isArray(versions)) {
		return versions.map((version) => nodeMajorVersion(version))
	} else {
		console.error({ versions })
		throw new Error('Expected array/string/number input for nodeMajorVersions')
	}
}

/**
 * Ensure that the suffix path does not start with the prefix directory path.
 * @param {string} prefix - Directory path prefix to remove
 * @param {string} suffix - Path that may start with the prefix
 * @returns {string|null} Path with prefix removed, or null if suffix is falsy
 */
export function unjoin(prefix, suffix) {
	if (!suffix) return null
	const start = prefix.endsWith('/') ? prefix : prefix + '/'
	const result = suffix.startsWith(start)
		? suffix.substring(start.length)
		: start
	return result
}

/**
 * Ensure that the suffix path starts with the prefix directory path.
 * @param {string} prefix - Directory path prefix to prepend
 * @param {string} suffix - Path that may need the prefix prepended
 * @returns {string|null} Path with prefix prepended, or null if suffix is falsy
 */
export function cojoin(prefix, suffix) {
	if (!suffix) return null
	const start = prefix.endsWith('/') ? prefix : prefix + '/'
	const result = suffix.startsWith(start) ? suffix : start + suffix
	return result
}

/**
 * Is the value empty?
 * @param {*} value - Value to check for emptiness
 * @returns {boolean} True if the value is empty, false otherwise
 */
export function isEmpty(value) {
	if (value == null) return true
	if (value === '') return true
	if (
		typeChecker.isPlainObject(value) &&
		typeChecker.isEmptyPlainObject(value)
	) {
		return true
	}
	return false
}

/**
 * Set the property inside the object to the value, however if value is empty, delete the property instead.
 * @param {object} obj - Object to modify
 * @param {string} key - Property key to set or delete
 * @param {*} value - Value to set, or if empty, property will be deleted
 * @returns {void}
 */
export function set(obj, key, value) {
	if (isEmpty(value)) delete obj[key]
	else obj[key] = value
}

/**
 * Get the import/require statement text
 * @param {string} left - Variable name or destructuring pattern for the import
 * @param {string} right - Module name to import from
 * @param {boolean} [isESM] - Whether to use ESM import syntax (default: true)
 * @returns {string} An ESM import if `isESM` is truthy, otherwise a CJS require if `isESM` is falsey
 */
export function importOrRequire(left, right, isESM = true) {
	return isESM
		? `import ${left} from '${right}'`
		: `const ${left} = require('${right}')`
}

/**
 * Get the export statement text
 * @param {string} content - Content to export
 * @param {boolean} [isESM] - Whether to use ESM export syntax (default: true)
 * @returns {string} An ESM export if `isESM` is truthy, otherwise a CJS export if `isESM` is falsey
 */
export function exportOrExports(content, isESM = true) {
	return isESM ? `export default ${content}` : `module.exports = ${content}`
}

/**
 * Get the `use strict` header text, but only if it is needed.
 * @param {boolean} [isESM] - Whether to use ESM syntax (default: true)
 * @returns {string} Empty string for ESM, 'use strict' for CJS
 */
export function useStrict(isESM = true) {
	return isESM ? '' : "'use strict'\n"
}

/**
 * Get packages from both `dependencies` and `devDependencies`
 * @param {object} packageData - Package.json data object
 * @returns {string[]} Array of all dependency package names
 */
export function getAllDepNames(packageData) {
	if (!packageData.dependencies) packageData.dependencies = {}
	if (!packageData.devDependencies) packageData.devDependencies = {}
	const depNames = Object.keys(packageData.dependencies)
	const devDepNames = Object.keys(packageData.devDependencies)
	return depNames.concat(devDepNames)
}

/**
 * Get packages that exist in both `dependencies` and `devDependencies`
 * @param {object} packageData - Package.json data object
 * @returns {string[]} Array of duplicate dependency package names
 */
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

/**
 * Decrement the version number by the specified arguments
 * @param {string|number} version - Version string to decrement
 * @param {number} [major] - Major version decrement amount (default: 0)
 * @param {number} [minor] - Minor version decrement amount (default: 1)
 * @returns {string} Decremented version string
 */
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

/**
 * Fix typescript embedding the source directory inside the output
 * @param {string} editionDirectory - Target edition directory path
 * @param {string} sourceDirectory - Source directory path
 * @returns {string[]} Array of shell command parts to fix tsc output
 */
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

/**
 * If only one person, then no need to display the years
 * @param {string|string[]} people - People string or array to format
 * @returns {string[]} Array of formatted people strings
 */
export function fixAuthors(people) {
	const fellows = Fellow.add(people)
	const opts = { displayYears: fellows.length !== 1 }
	return fellows.map((fellow) => fellow.toString(opts))
}

/**
 * Convert Bevry to Benjamin Lupton
 * @param {string} input - Input string containing author information
 * @returns {string} Fixed author string with Bevry references converted
 */
export function fixAuthor(input) {
	const people = input
		.split(', ')
		.map((person) =>
			person
				.replace('Bevry Pty Ltd', 'Benjamin Lupton')
				.replace('<us@bevry.me>', '<b@lupton.cc>')
				.replace('://bevry.me', '://balupton.com'),
		)
		.join(', ')
	return fixAuthors(people).join(', ')
}

/**
 * Fix various bad forms of Benjamin Lupton
 * @param {string} person - Person string to fix
 * @returns {string} Fixed person string with standardized Benjamin Lupton format
 */
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

/**
 * Trim the organisation/scope name from the package name
 * @param {string} str - Package name string possibly containing org scope
 * @returns {string} Package name with org scope removed
 */
export function trimOrgName(str) {
	if (str[0] === '@') return str.split('/').slice(1).join('/')
	return str
}

/**
 * Strip the object of the keys
 * @param {object} obj - Object to modify
 * @param {...any} keys - Keys to remove from the object
 * @returns {object} The modified object with keys removed
 */
export function strip(obj, ...keys) {
	for (const key of keys) {
		delete obj[key]
	}
	return obj
}

/**
 * Add file extension to a filename
 * @param {string} file - Filename to add extension to
 * @param {string} extension - Extension to add (without dot)
 * @returns {string|undefined} Filename with extension, or original value if file is falsy
 */
export function addExtension(file, extension) {
	return file ? `${file}.${extension}` : file
}

/**
 * Trim the string
 * @param {string} [input] - String to trim (default: empty string)
 * @returns {string} Trimmed string
 */
export function trim(input = '') {
	return input.trim()
}

/**
 * Create a slug from input string by removing non-alphanumeric characters
 * @param {string} input - Input string to convert to slug
 * @returns {string} Slugified string containing only alphanumeric characters, dots, and hyphens
 */
export function slugit(input) {
	return (
		(input && input !== 'undefined' && input.replace(/[^a-zA-Z0-9.-]+/g, '')) ||
		''
	)
}

/**
 * Check if input has meaningful content after slugification
 * @param {string|string[]} input - Input string or array to check
 * @returns {boolean} True if input has content after slugification
 */
export function isSpecified(input) {
	return slugit(Array.isArray(input) ? input.join(' ') : input).length !== 0
}

/**
 * Is the string representing a positive number?
 * @param {string} input - Input string to check
 * @returns {boolean} True if input represents a positive number
 */
export function isNumber(input) {
	return /^[0-9.]+$/.test(input)
}

export const defaultScript = "printf '%s\n' 'no need for this project'"

export const defaultDeploy =
	'npm run our:compile && npm run our:test && npm run our:deploy'

/**
 * Check if scripts object has a specific script that's not the default
 * @param {object} scripts - Scripts object from package.json
 * @param {string} name - Script name to check for
 * @returns {boolean} True if script exists and is not the default script
 */
export function hasScript(scripts, name) {
	return scripts && scripts[name] && scripts[name] !== defaultScript
}

/**
 * Ensure a script exists in the scripts object, setting it to default if missing
 * @param {object} scripts - Scripts object from package.json
 * @param {string} name - Script name to ensure exists
 * @returns {void}
 */
export function ensureScript(scripts, name) {
	if (scripts && !scripts[name]) scripts[name] = defaultScript
}
