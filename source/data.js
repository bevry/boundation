'use strict'

module.exports = {
	bevryOrganisationsList: 'balupton bevry bevry-trading docpad browserstate webwrite chainyjs interconnectapp'.split(
		' '
	),
	allNodeVersions: [
		'0.8',
		'0.10',
		'0.12',
		'4',
		'6',
		'8',
		'10',
		'12',
		'13',
		'14',
	],
	allLanguages: [
		'typescript',
		'esnext',
		'es5',
		'coffeescript',
		'json',
		'react',
		'jsx',
		'mdx',
		'html',
		'css',
	],
	allEsTargets: [
		'ESNext',
		'ES2020',
		'ES2019',
		'ES2018',
		'ES2017',
		'ES2016',
		'ES2015',
		'ES5',
		'ES3',
	],
	npmAuthToken: process.env.NPM_AUTHTOKEN,
	travisEmail: process.env.TRAVIS_NOTIFICATION_EMAIL,
	surgeLogin: process.env.SURGE_LOGIN,
	surgeToken: process.env.SURGE_TOKEN,
	nowToken: process.env.NOW_TOKEN,
}
