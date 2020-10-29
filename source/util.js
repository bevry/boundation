import { bevryOrganisationsList } from './data.js'
import * as typeChecker from 'typechecker'

// utilities
export function first(arr) {
	return arr[0]
}

export function last(arr) {
	return arr[arr.length - 1]
}

export function unjoin(a, b) {
	if (!b) return null
	const A = a.endsWith('/') ? a : a + '/'
	const B = b.startsWith(A) ? b.substr(A.length) : A
	return B
}

export function cojoin(a, b) {
	if (!b) return null
	const A = a.endsWith('/') ? a : a + '/'
	const B = b.startsWith(A) ? b : A + b
	return B
}

export function isEmpty(value) {
	if (value == null) return true
	if (value === '') return true
	if (typeChecker.isPlainObject(value) && typeChecker.isEmptyPlainObject(value))
		return true
	return false
}

export function set(obj, key, value) {
	if (isEmpty(value)) delete obj[key]
	else obj[key] = value
}

// return the bin entry as a string (if single bin entry), or as an object of strings that point to the same bin entry (if multiple bin names)
export function binField(answers, binEntry) {
	if (answers.binExecutable) {
		if (answers.binExecutable === answers.name) {
			return binEntry
		} else {
			const result = {}
			for (const executable of answers.binExecutable.split(/,\s*/)) {
				result[executable] = binEntry
			}
			return result
		}
	}
	return null
}

export function importOrRequire(left, right, modules = true) {
	return modules
		? `import ${left} from '${right}'`
		: `const ${left} = require('${modules}')`
}

export function exportOrExports(content, modules = true) {
	return modules ? `export default ${content}` : `module.exports = ${content}`
}

export function useStrict(modules = true) {
	return modules ? '' : "'use strict'\n"
}

export function getAllDepNames(packageData) {
	if (!packageData.dependencies) packageData.dependencies = {}
	if (!packageData.devDependencies) packageData.devDependencies = {}
	const depNames = Object.keys(packageData.dependencies)
	const devDepNames = Object.keys(packageData.devDependencies)
	return depNames.concat(devDepNames)
}

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

// fix typescript embedding the source directory inside the output
export function fixTsc(editionDirectory, sourceDirectory) {
	return [
		'&&',
		'(', // begin fix
		`test ! -d ${editionDirectory}/${sourceDirectory}`,
		'||',
		'(', // begin move
		`mv ${editionDirectory}/${sourceDirectory} edition-temp`,
		`&& rm -Rf ${editionDirectory}`,
		`&& mv edition-temp ${editionDirectory}`,
		`)`, // end move
		')', // end fix
	]
}

export function fixBalupton(person) {
	return person
		.replace(
			/^Benjamin Lupton( <b@lupton.cc>)?$/,
			'Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)'
		)
		.replace(
			/^Benjamin Lupton( <b@lupton.cc>)? \(https?:\/\/github.com\/balupton\)$/,
			'Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)'
		)
		.replace(
			/^Benjamin Lupton( <b@lupton.cc>)? \(https?:\/\/balupton.com\/?\)$/,
			'Benjamin Lupton <b@lupton.cc> (https://github.com/balupton)'
		)
}

export function trimOrgName(str) {
	if (str[0] === '@') return str.split('/').slice(1).join('/')
	return str
}

export function has(s = [], i) {
	// @ts-ignore
	const check = s.has || s.includes
	return check ? check.call(s, i) : s[i] != null
}

export function add(s, ...a) {
	const add = s.add || s.push
	for (const i of a) {
		add.call(s, i)
	}
	return s
}

export function strip(o, ...a) {
	for (const i of a) {
		delete o[i]
	}
	return o
}

export function addExtension(file, extension) {
	return file ? `${file}.${extension}` : file
}

export function toggle(set, value, mode) {
	if (Array.isArray(value)) {
		for (const v of value) {
			toggle(set, v, mode)
		}
		return set
	}
	if (mode) {
		set.add(value)
	} else {
		set.delete(value)
	}
	return set
}

export function isBevryOrganisation(organisation) {
	return bevryOrganisationsList.includes(organisation)
}

export function trim(input) {
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

/**
 * Get the distinct elements from both the lists.
 * Given two sets A and B, their union is the set consisting of all objects which are elements of A or of B or of both (see axiom of union). It is denoted by A ∪ B.
 * https://en.wikipedia.org/wiki/Naive_set_theory
 * @param {Array<*>} list The left subset.
 * @param {Array<*>} include The right subset.
 * @returns the superset/combination of both lists, without redundancy.
 */
export function union(list, include) {
	return Array.from(new Set(list.concat(include)).values())
}

/**
 * Get the elements from the list that only also exist within the other list.
 * The intersection of A and B is the set of all objects which are both in A and in B. It is denoted by A ∩ B.
 * https://en.wikipedia.org/wiki/Naive_set_theory
 * @param {Array<*>} list The left set to intersect.
 * @param {Array<*>} allowlist The right set to intersect.
 * @returns the intersection, the values that are within both sets
 */
export function intersect(list, allowlist) {
	return list.filter((value) => allowlist.includes(value))
}

/**
 * Get the list without elements from the other list.
 * Finally, the relative complement of B relative to A, also known as the set theoretic difference of A and B, is the set of all objects that belong to A but not to B. It is written as A \ B or A − B.
 * https://en.wikipedia.org/wiki/Naive_set_theory
 * @param {Array<*>} list The superset.
 * @param {Array<*>} blacklist The excluded subset.
 *
 */
export function complement(list, blacklist) {
	return list.filter((value) => blacklist.includes(value) === false)
}

export function uniq(list) {
	return Array.from(new Set(list.filter((i) => i)).values())
}

export const defaultScript = 'echo no need for this project'

export const defaultDeploy =
	'npm run our:compile && npm run our:test && npm run our:deploy'

export function hasScript(scripts, name) {
	return scripts && scripts[name] && scripts[name] !== defaultScript
}
export function ensureScript(scripts, name) {
	if (scripts && !scripts[name]) scripts[name] = defaultScript
}
