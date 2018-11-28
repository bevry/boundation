'use strict'

async function updateWebsite(state) {
	const { answers, packageData } = state

	// add website deployment strategies
	if (answers.deploy && answers.deploy.startsWith('now')) {
		// @todo add support for now v2
		// https://zeit.co/docs/v2/deployments/official-builders/node-js-now-node/
		// https://zeit.co/docs/v2/deployments/official-builders/static-now-static/
		// https://zeit.co/docs/v2/deployments/official-builders/next-js-now-next/
		// @todo add support for
		// https://zeit.co/docs/v1/static-deployments/configuration/#redirects-(array)
		packageData.now = Object.assign(
			{
				version: 1,
				name: answers.nowName,
				type: 'static',
				public: true,
				alias: answers.nowAliases || [],
				files: [answers.deployDirectory],
				static: {
					directoryListing: false,
					cleanUrls: true,
					trailingSlash: false,
					public: 'out'
				}
			},
			packageData.now
		)
	}
}

module.exports = { updateWebsite }
