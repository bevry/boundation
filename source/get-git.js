// local
import { pwd } from './data.js'
import { exec } from './fs.js'
import { repoToOrganisation, repoToProject } from './util.js'

// Cache the results for different repositories
const details = {}

export async function getGitOriginUrl(cwd = pwd) {
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

export async function getGitOrganisation(cwd = pwd) {
	return repoToOrganisation(await getGitOriginUrl(cwd)) || null
}

export async function getGitProject(cwd = pwd) {
	return repoToProject(await getGitOriginUrl(cwd)) || null
}

export async function getGitUsername(cwd = pwd) {
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

async function getGitGlobalConfigDefaultBranch(cwd = pwd) {
	try {
		const stdout = await exec('git config --global init.defaultBranch', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		return result
	} catch (error) {
		return null
	}
}

async function getGitLocalConfigDefaultBranch(cwd = pwd) {
	try {
		const stdout = await exec('git config init.defaultBranch', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		return result
	} catch (error) {
		return null
	}
}

async function getGitActiveDefaultBranch(cwd = pwd) {
	try {
		const stdout = await exec('git rev-parse --abbrev-ref HEAD', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		return result
	} catch (error) {
		return null
	}
}

export async function getGitDefaultBranch(cwd = pwd) {
	const detail = (details[cwd] = details[cwd] || {})
	if (detail.branch) return detail.branch
	try {
		const result =
			(await getGitActiveDefaultBranch()) ||
			(await getGitLocalConfigDefaultBranch()) ||
			(await getGitGlobalConfigDefaultBranch()) ||
			'main'
		detail.branch = result
		return result
	} catch (error) {
		return null
	}
}

export async function getGitEmail(cwd = pwd) {
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
