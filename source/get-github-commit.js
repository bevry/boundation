// external
import fetch from 'node-fetch'
import gh from 'githubauthreq'
const { getHeaders } = gh
import { env } from 'process'

// local
import { warn, fatal } from './log.js'
const { GITHUB_API = 'https://api.github.com' } = env

export async function getGithubCommit(slug, fallback = 'master') {
	const url = `${GITHUB_API}/repos/${slug}/commits`
	try {
		const headers = getHeaders()
		const init = {
			headers: {
				...headers,
				'User-Agent': 'bevry/boundation',
			},
		}
		const response = await fetch(url, init)
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
