'use strict'

const pathUtil = require('path')
const { exists, parse } = require('./fs')
const { hasPackageScript, hasPackageDependency } = require('./package')

function getNowName(nowData) {
	return nowData.name || null
}

function parseNowAliases(alias) {
	if (alias) {
		return Array.isArray(alias) ? alias : alias.split(/[,\s]+/)
	}
	return null
}

function getNowAliases(nowData) {
	return parseNowAliases(nowData.alias) || []
}

function getWebsiteType({ packageData, nowData }) {
	return hasPackageDependency(packageData, 'docpad')
		? 'docpad'
		: getNowName(nowData)
		? 'now'
		: hasPackageScript(packageData, 'start')
}

async function readWebsite(state) {
	const { cwd, packageData } = state

	// now
	const nowPath = pathUtil.resolve(cwd, 'now.json')
	let nowData = {}
	try {
		if (await exists(nowPath)) nowData = (await parse(nowPath)) || {}
	} catch (err) {}

	// apply
	state.nowData = Object.assign({}, packageData.now || {}, nowData)
}

async function updateWebsite(state) {
	const { answers, nowData } = state

	// add website deployment strategies
	if (answers.deploy && answers.deploy.startsWith('now')) {
		// @todo add support for now v2
		// https://zeit.co/docs/v2/deployments/official-builders/node-js-now-node/
		// https://zeit.co/docs/v2/deployments/official-builders/static-now-static/
		// https://zeit.co/docs/v2/deployments/official-builders/next-js-now-next/
		// @todo add support for
		// https://zeit.co/docs/v1/static-deployments/configuration/#redirects-(array)
		state.nowData = Object.assign(
			{
				version: 1,
				name: answers.nowName,
				type: 'static',
				public: true,
				alias: parseNowAliases(answers.nowAliases),
				files: [answers.deployDirectory],
				static: {
					directoryListing: false,
					cleanUrls: true,
					trailingSlash: false,
					public: 'out'
				}
			},
			nowData
		)
	}
}

module.exports = {
	getWebsiteType,
	readWebsite,
	getNowAliases,
	getNowName,
	updateWebsite
}
