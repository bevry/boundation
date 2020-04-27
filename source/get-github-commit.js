/* eslint no-console:0 */
'use strict'

// Local
const { warn, fatal } = require('./log')
const { getHeaders } = require('githubauthreq')
const ghapi = process.env.GITHUB_API || 'https://api.github.com'

// External
const { fetch } = require('fetch-h2')

async function getGithubCommit(slug, fallback = 'master') {
	const url = `${ghapi}/repos/${slug}/commits`
	try {
		const response = await fetch(url, {
			headers: getHeaders(),
		})
		if (response.status < 200 || response.status >= 300) {
			throw await response.text()
		}
		const result = await response.json()
		if (result.message) {
			throw new Error(result.message + '\n' + url)
		}
		if (!result[0] || !result[0].sha) {
			return fatal(
				new Error(`${url} did not return the expected result`),
				result
			)
		}
		const commit = result[0].sha
		return commit
	} catch (err) {
		warn(`fetching the latest ${slug} commit failed, so using ${fallback}`)
		return fallback
	}
}

module.exports = { getGithubCommit }
