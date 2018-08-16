'use strict'

async function updateWebsite (state) {
	const { answers, packageData } = state

	// add website deployment strategies
	if (answers.deploy && answers.deploy.startsWith('now')) {
		packageData.now = Object.assign(
			{
				name: answers.nowName,
				type: 'static',
				public: true,
				alias: answers.nowAliases || [],
				files: [
					answers.deployDirectory
				],
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
