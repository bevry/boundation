/* eslint no-console:0 */
'use strict'

// Local
const { warn } = require('./log')
const {
	fetchGithubAuthQueryString,
	redactGithubAuthQueryString
} = require('githubauthquerystring')

// External
const fetch = require('node-fetch')

async function getGithubCommit(slug, fallback = 'master') {
	try {
		const response = await fetch(
			`https://api.github.com/repos/${slug}/commits?${fetchGithubAuthQueryString()}`,
			{
				headers: {
					Accept: 'application/vnd.github.v3+json'
				}
			}
		)
		const result = await response.json()
		if (result.message) {
			throw new Error(result.message)
		}
		const commit = result[0].sha
		return commit
	} catch (err) {
		warn(
			`fetching the latest ${slug} commit failed, so using ${fallback}`,
			redactGithubAuthQueryString(err.toString())
		)
		return fallback
	}
}

module.exports = { getGithubCommit }
