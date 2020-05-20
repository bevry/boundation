'use strict'

const { bevryOrganisationsList } = require('./data')

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
