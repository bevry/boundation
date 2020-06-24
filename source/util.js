'use strict'

const { bevryOrganisationsList } = require('./data.js')

function getAllDepNames(packageData) {
	if (!packageData.dependencies) packageData.dependencies = {}
	if (!packageData.devDependencies) packageData.devDependencies = {}
	const depNames = Object.keys(packageData.dependencies)
	const devDepNames = Object.keys(packageData.devDependencies)
	return depNames.concat(devDepNames)
}

function getDuplicateDeps(packageData) {
	const allDepNames = new Set(getAllDepNames(packageData))
	const duplicateDepNames = []
	for (const key of allDepNames) {
		if (packageData.devDependencies[key] && packageData.dependencies[key]) {
			duplicateDepNames.push(key)
		}
	}
	return duplicateDepNames
}

function getPreviousVersion(version, major = 0, minor = 1) {
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
function fixTsc(editionDirectory, sourceDirectory) {
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

function fixBalupton(person) {
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

function trimOrgName(str) {
	if (str[0] === '@') return str.split('/').slice(1).join('/')
	return str
}

function has(s = [], i) {
	// @ts-ignore
	const check = s.has || s.includes
	return check ? check.call(s, i) : s[i] != null
}

function add(s, ...a) {
	const add = s.add || s.push
	for (const i of a) {
		add.call(s, i)
	}
	return s
}

function strip(o, ...a) {
	for (const i of a) {
		delete o[i]
	}
	return o
}

function addExtension(file, extension) {
	return file ? `${file}.${extension}` : file
}

function toggle(set, value, mode) {
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

function isBevryOrganisation(organisation) {
	return bevryOrganisationsList.includes(organisation)
}

function trim(input) {
	return input.trim()
}
function slugit(input) {
	return (
		(input && input !== 'undefined' && input.replace(/[^a-zA-Z0-9.-]+/g, '')) ||
		''
	)
}
function isSpecified(input) {
	return slugit(Array.isArray(input) ? input.join(' ') : input).length !== 0
}
function isNumber(input) {
	return /^[0-9.]+$/.test(input)
}
function isGitUrl(input) {
	return /\.git$/.test(input)
}
function repoToWebsite(input = '') {
	return input
		.replace(/\.git$/, '')
		.replace(/^(ssh[:/]+)?git@github\.com[:/]*/, 'https://github.com/')
}
function repoToSlug(input = '') {
	return (
		(input && input.replace(/\.git$/, '').replace(/^.+?\.com[:/]*/, '')) || ''
	)
}
function repoToOrganisation(input = '') {
	return (input && repoToSlug(input).split('/')[0]) || ''
}
function repoToProject(input = '') {
	return (input && repoToSlug(input).split('/')[1]) || ''
}

function without(list, blacklist) {
	return list.filter((value) => blacklist.includes(value) === false)
}

function uniq(list) {
	return Array.from(new Set(list.filter((i) => i)).values())
}

const defaultScript = 'echo no need for this project'
const defaultDeploy =
	'npm run our:compile && npm run our:test && npm run our:deploy'
function hasScript(scripts, name) {
	return scripts && scripts[name] && scripts[name] !== defaultScript
}
function ensureScript(scripts, name) {
	if (scripts && !scripts[name]) scripts[name] = defaultScript
}

module.exports = {
	getAllDepNames,
	getDuplicateDeps,
	getPreviousVersion,
	fixTsc,
	fixBalupton,
	defaultDeploy,
	ensureScript,
	hasScript,
	trimOrgName,
	add,
	addExtension,
	has,
	isBevryOrganisation,
	isGitUrl,
	isNumber,
	isSpecified,
	repoToOrganisation,
	repoToProject,
	repoToSlug,
	repoToWebsite,
	slugit,
	strip,
	toggle,
	trim,
	uniq,
	without,
}
