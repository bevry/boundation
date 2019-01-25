'use strict'

module.exports = {
	allNodeVersions: '0.8 0.10 0.12 4 6 8 10 11'.split(' '),
	npmAuthToken: process.env.NPM_AUTHTOKEN,
	travisEmail: process.env.TRAVIS_NOTIFICATION_EMAIL,
	surgeLogin: process.env.SURGE_LOGIN,
	surgeToken: process.env.SURGE_TOKEN,
	nowToken: process.env.NOW_TOKEN
}
