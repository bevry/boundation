/* eslint no-console:0 */
'use strict'

const Errlop = require('errlop').default
const fetch = require('node-fetch').default
const crypto = require('crypto')

// curl flags:
// -L will follow redirects
// -s is silent mode, so will only return the result
// -S will show the error if something went wrong
// -f will not output errors as content
// https://github.com/bevry/boundation/issues/15
const curlFlags = '-fsSL'

// Local
const { writePackage } = require('./package')
const { status } = require('./log')
const { getGithubCommit } = require('./get-github-commit')
const { spawn, readYAML, writeYAML } = require('./fs')
const { hasScript } = require('./util')

// Thing
async function updateTravis(state) {
	const { answers, nodeVersions, unsupportedNodeVersions, packageData } = state

	// =================================
	// customise travis

	status('customising travis...')

	// prepare
	/* eslint camelcase:0 */
	status('fetching github commit...')
	const awesomeTravisCommit = await getGithubCommit('bevry/awesome-travis')
	status('...fetched github commit')
	const travisOriginal = await readYAML('.travis.yml')
	const travis = {
		version: '~> 1.0',
		sudo: false,
		language: 'node_js',
		node_js: nodeVersions,
		matrix: {
			fast_finish: true,
			allow_failures: unsupportedNodeVersions.map((version) => ({
				node_js: version,
			})),
		},
		cache: answers.packageManager,
		install: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-install.bash)"`,
		],
		before_script: [
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-verify.bash)"`,
		],
		after_success: [],
	}

	// default to travis-ci.com
	state.travisTLD =
		'' /*
		(packageData &&
			packageData.badges &&
			packageData.badges.config &&
			packageData.badges.tavisTLD) ||
		''*/

	// update the travis file
	if (answers.cdnDeploymentStrategy === 'surge') {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/surge.bash)"`
		)
	}
	if (answers.travisWebsite || hasScript(packageData.scripts, 'my:deploy')) {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/deploy-custom.bash"`
		)
	}
	if (answers.npm || answers.cdnDeploymentStrategy === 'bevry') {
		travis.after_success.push(
			`eval "$(curl ${curlFlags} https://raw.githubusercontent.com/bevry/awesome-travis/${awesomeTravisCommit}/scripts/node-publish.bash)"`
		)
	}

	// re-add notifications if we aren't making new ones
	if (!answers.travisUpdateEnvironment && travisOriginal.notifications) {
		travis.notifications = travisOriginal.notifications
	}

	// trim empty fields to prevent travis errors like:
	// travis_run_after_success: command not found
	Object.keys(travis).forEach(function (key) {
		const value = travis[key]
		if (Array.isArray(value) && value.length === 0) {
			delete travis[key]
		} else if (typeof value === 'object' && Object.keys(value).length === 0) {
			delete travis[key]
		} else if (value === '' || value == null) {
			delete travis[key]
		}
	})

	// travis env variables
	// these spawns must be run serially, as otherwise not all variables may be written, which is annoying
	if (answers.travisUpdateEnvironment) {
		// Detect which travis environments we are configured for
		status('updating the travis environment...')

		/* eslint no-inner-declarations:0 max-params:0 */
		async function api(tld, repo, path = '', method = 'GET', params = null) {
			const url = `https://api.travis-ci.${tld}/repo/${encodeURIComponent(
				repo
			)}${path ? `/${path}` : ''}`
			const opts = {
				method,
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'bevry/boundation',
					'Travis-API-Version': '3',
					Authorization: `token ${
						tld === 'org' ? answers.travisOrgToken : answers.travisComToken
					}`,
				},
			}
			if (params) opts.body = JSON.stringify(params)
			const res = await fetch(url, opts)
			const text = await res.text()
			if (!text) {
				if (res.ok) {
					return null // support DELETE and other times it passes but returns nothing
				} else {
					console.dir({ url, opts, text })
					return Promise.reject(
						new Error(`request failed with ${res.status}: ${res.statusText}`)
					)
				}
			}
			try {
				const data = JSON.parse(text)
				let error = null
				if (!data) {
					error = new Errlop('no data was returned', error)
				} else if (data.error_message) {
					error = new Errlop(`${data.error_type}: ${data.error_message}`, error)
				} else if (data.errors) {
					for (const [key, value] of Object.entries(data.errors)) {
						error = new Errlop(`${key}: ${value.default_message}`, error)
					}
				}
				if (error) {
					return Promise.reject(error)
				}
				return data
			} catch (err) {
				console.dir({ url, opts, text })
				return Promise.reject(
					new Errlop(`couldn't parse the data: ${text}`, err)
				)
			}
		}
		function encrypt(data, value) {
			// console.dir(data)
			/*
				Sometimes travis varies its output, the replace solves the problem, otherwise this occurs:
				Error: error:0D0680A8:asn1 encoding routines:asn1_check_tlen:wrong tag
					opensslErrorStack: [
						'error:0D09B00D:asn1 encoding routines:d2i_PublicKey:ASN1 lib',
						'error:0D07803A:asn1 encoding routines:asn1_item_embed_d2i:nested asn1 error'
					],
					library: 'asn1 encoding routines',
					function: 'asn1_check_tlen',
					reason: 'wrong tag',
					code: 'ERR_OSSL_ASN1_WRONG_TAG'
		  	*/
			const opts = {
				key: data.public_key.replace(/RSA PUBLIC KEY/g, 'PUBLIC KEY'),
				padding: crypto.constants.RSA_PKCS1_PADDING,
			}
			// console.dir(opts)
			return crypto.publicEncrypt(opts, Buffer.from(value)).toString('base64')
		}

		// disable travis-ci.org
		if (answers.travisOrgToken && answers.travisComToken) {
			state.travisTLD = 'com'
			console.log('disabling travis-ci.org')
			try {
				const data = await api('org', answers.githubSlug)
				if (data.migration_status === 'migrated') {
					console.log('travis-ci.org has already migrated')
				} else {
					try {
						console.log('migrating travis-ci.org')
						await api('org', answers.githubSlug, 'migrate', 'POST')
					} catch (err) {
						console.warn(new Errlop('failed to migrate', err))
					}
				}
			} catch (err) {
				console.warn(new Errlop('failed to query', err))
			}
			// fails as travis cannot modify migrated repositories
			// console.log('clearing travis.ci.org env vars')
			// try {
			// 	const vars = await apivars('org', answers.githubSlug)
			// 	for (const value of vars) {
			// 		console.log(`deleteing env var [${value.name}]:[${value.id}]`)
			// 		try {
			// 			await api(
			// 				'org',
			// 				answers.githubSlug,
			// 				`env_var/${value.id}`,
			// 				'DELETE'
			// 			)
			// 		} catch (err) {
			// 			console.warn(new Errlop('failed to delete env var', err))
			// 		}
			// 	}
			// } catch (err) {
			// 	console.warn(new Errlop('failed to fetch the env vars', err))
			// }
		} else if (answers.travisOrgToken) {
			state.travisTLD = 'org'
		} else {
			state.travisTLD = 'com'
		}

		// enable travis-ci
		console.log(`enabling travis-ci.${state.travisTLD}`)
		let active = (await api(state.travisTLD, answers.githubSlug)).active
		if (!active) {
			try {
				console.log('already active')
				await api(state.travisTLD, answers.githubSlug, 'activate', 'POST')
				active = true
			} catch (err) {
				console.warn(new Errlop('failed to activate', err))
			}
		}

		// check if activated
		if (!active) {
			// status update
			status('...FAILED to update the travis environment')
		} else {
			if (answers.travisEmail) {
				// add the notifications to the travis.yml file
				const value = [answers.travisEmail]
				if (!travis.notifications) travis.notifications = {}
				if (!travis.notifications.email) travis.notifications.email = {}
				console.log('setting the email recipients to', value)
				const keyData = await api(
					state.travisTLD,
					answers.githubSlug,
					'key_pair/generated'
				)
				travis.notifications.email.recipients = encrypt(keyData, value)
			}

			// fetch the current vars
			const vars = {}
			const data = await api(state.travisTLD, answers.githubSlug, 'env_vars')
			for (const value of data.env_vars || []) {
				vars[value.name] = value
			}

			// do the deleta
			const isPublic = new Set([
				'DESIRED_NODE_VERSION',
				'SURGE_LOGIN',
				'NPM_BRANCH_TAG',
				'GITHUB_API',
			])
			const delta = {
				NPM_USERNAME: null,
				NPM_PASSWORD: null,
				NPM_EMAIL: null,
				DESIRED_NODE_VERSION: answers.desiredNodeVersion || null,
				DEPLOY_BRANCH: answers.deployBranch || null,
				SURGE_LOGIN: answers.surgeLogin || null,
				SURGE_TOKEN: answers.surgeToken || null,
				BEVRY_CDN_TOKEN: answers.bevryCDNToken || null,
				NPM_AUTHTOKEN: answers.npmAuthToken || null,
				// publish all commits to the master branch to the npm tag next
				NPM_BRANCH_TAG: answers.npm ? 'master:next' : null,
				// proxy github api requests to the bevry server to work around rate limiting
				GITHUB_API: answers.npm ? 'https://bevry.me/api/github' : null,
			}

			// output the result env vars
			for (const [name, value] of Object.entries(delta)) {
				const details = vars[name]
				if (details) {
					const makePublic = isPublic.has(name)
					// item exists
					if (value == null) {
						// delete it
						await api(
							state.travisTLD,
							answers.githubSlug,
							`env_var/${encodeURIComponent(details.id)}`,
							'DELETE'
						)
						console.log(`${name} = [deleted]`)
					} else if (details.value !== value || details.public !== makePublic) {
						// apply change
						await api(
							state.travisTLD,
							answers.githubSlug,
							`env_var/${encodeURIComponent(details.id)}`,
							'PATCH',
							{
								'env_var.name': name,
								'env_var.value': value,
								'env_var.public': makePublic,
							}
						)
						console.log(`${name} = ${makePublic ? value : '[hidden]'}`)
					} else {
						// already applied
						console.log(
							`${name} === ${details.public ? details.value : '[hidden]'}`
						)
					}
				} else if (value) {
					// add it
					await api(state.travisTLD, answers.githubSlug, 'env_vars', 'POST', {
						'env_var.name': name,
						'env_var.value': value,
						'env_var.public': isPublic.has(name),
					})
					console.log(`${name} = ${isPublic.has(name) ? value : '[hidden]'}`)
				} else {
					// already missing, so no need to delete
					console.log(`${name} === [deleted]`)
				}
			}

			// output remaining
			for (const [name, details] of Object.entries(vars)) {
				if (delta[name]) continue
				console.log(
					`${name} === ${details.public ? details.value : '[hidden]'}`
				)
			}

			// status update
			status('...updated the travis environment')
		}
	}

	// write the .travis.yml file
	status('writing the travis file...')
	await writeYAML('.travis.yml', travis)
	status('...wrote the travis file')

	// write the package.json file
	await writePackage(state)

	// log
	status('...customised travis')
}

module.exports = { updateTravis }
