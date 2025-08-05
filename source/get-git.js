// local
import { pwd } from './data.js'
import { exec } from './fs.js'
import { repoToUsername, repoToProject } from './package.js'

// Cache the results for different repositories
const details = {}

/**
 * Get the git origin URL for a repository
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The git origin URL or null if not found
 */
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
	} catch {
		return null
	}
}

/**
 * Get the git organization name from the repository URL
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The organization name or null if not found
 */
export async function getGitOrganisation(cwd = pwd) {
	return repoToUsername(await getGitOriginUrl(cwd)) || null
}

/**
 * Get the git project name from the repository URL
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The project name or null if not found
 */
export async function getGitProject(cwd = pwd) {
	return repoToProject(await getGitOriginUrl(cwd)) || null
}

/**
 * Get the git username from global git config
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The git username or null if not found
 */
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
	} catch {
		return null
	}
}

/**
 * Get the default branch name from git global config
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The default branch name or null if not configured
 */
async function getGitGlobalConfigDefaultBranch(cwd = pwd) {
	try {
		const stdout = await exec('git config --global init.defaultBranch', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		return result
	} catch {
		return null
	}
}

/**
 * Get the default branch from local git config
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The local default branch name or null if not configured
 */
async function getGitLocalConfigDefaultBranch(cwd = pwd) {
	try {
		const stdout = await exec('git config init.defaultBranch', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		return result
	} catch {
		return null
	}
}

/**
 * Get the currently active git branch
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The active branch name or null if not in a git repository
 */
async function getGitActiveBranch(cwd = pwd) {
	try {
		const stdout = await exec('git rev-parse --abbrev-ref HEAD', {
			cwd,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const result = (stdout && stdout.toString().trim()) || null
		return result
	} catch {
		return null
	}
}

/**
 * Get the default git branch name, trying multiple sources
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The default branch name or 'main' as fallback
 */
export async function getGitDefaultBranch(cwd = pwd) {
	const detail = (details[cwd] = details[cwd] || {})
	if (detail.branch) return detail.branch
	try {
		const result =
			(await getGitActiveBranch()) ||
			(await getGitLocalConfigDefaultBranch()) ||
			(await getGitGlobalConfigDefaultBranch()) ||
			'main'
		detail.branch = result
		return result
	} catch {
		return null
	}
}

/**
 * Get the git email from global git config
 * @param {string} [cwd] - Working directory path
 * @returns {Promise<string|null>} The git email or null if not found
 */
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
	} catch {
		return null
	}
}
