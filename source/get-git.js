'use strict'

// Cache the results for different repositories
const details = {}

// Local
const { exec } = require('./fs.js')
const { repoToOrganisation, repoToProject } = require('./util.js')

async function getGitOriginUrl(cwd = process.cwd()) {
	const detail = (details[cwd] = details[cwd] || {})
	if (detail.origin) return detail.origin
	try {
		const stdout = await exec('git remote get-url origin', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		detail.origin = result
		return result
	} catch (error) {
		return null
	}
}

async function getGitOrganisation(cwd) {
	return repoToOrganisation(await getGitOriginUrl(cwd)) || null
}

async function getGitProject(cwd) {
	return repoToProject(await getGitOriginUrl(cwd)) || null
}

async function getGitUsername(cwd = process.cwd()) {
	const detail = (details[cwd] = details[cwd] || {})
	if (detail.username) return detail.username
	try {
		const stdout = await exec('git config --global user.name', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		detail.username = result
		return result
	} catch (error) {
		return null
	}
}

async function getGitBranch(cwd = process.cwd()) {
	const detail = (details[cwd] = details[cwd] || {})
	if (detail.branch) return detail.branch
	try {
		const stdout = await exec('git rev-parse --abbrev-ref HEAD', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		result.branch = result
		return result
	} catch (error) {
		return null
	}
}

async function getGitEmail(cwd = process.cwd()) {
	const detail = (details[cwd] = details[cwd] || {})
	if (detail.email) return detail.email
	try {
		const stdout = await exec('git config --global user.email', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		detail.email = result
		return result
	} catch (error) {
		return null
	}
}

module.exports = {
	getGitOriginUrl,
	getGitOrganisation,
	getGitProject,
	getGitUsername,
	getGitBranch,
	getGitEmail,
}
