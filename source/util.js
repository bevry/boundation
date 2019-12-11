'use strict'

const { bevryOrganisationsList } = require('./data')

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
	return list.filter(value => blacklist.includes(value) === false)
}

function uniq(list) {
	return Array.from(new Set(list.filter(i => i)).values())
}

module.exports = {
	has,
	add,
	strip,
	isBevryOrganisation,
	trim,
	slugit,
	isSpecified,
	isNumber,
	isGitUrl,
	repoToWebsite,
	repoToSlug,
	repoToOrganisation,
	repoToProject,
	without,
	uniq
}
