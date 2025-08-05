// builtin
import { cwd } from 'node:process'

// external
import {
	getESVersionsByDate,
	getESVersionByDate,
	getESVersionsByNow,
	getDateWithYearOffset,
} from '@bevry/ecmascript-versions'

import { unique } from '@bevry/list'

import { toLowerCase } from './util.js'

export const pwd = cwd()

export const pastBevrySponsors = [
	// fetched manually with incognito mode from: https://github.com/sponsors/balupton
	// as there isn't an api for this yet, when there is an api, add it to github-api
	{ githubUsername: 'dr-dimitru' },
	{ githubUsername: 'elliottditman' },
	{ githubUsername: 'Armenm' },
	{ githubUsername: 'WriterJohnBuck' },
	{ githubUsername: 'cryptoquick' },
	{ githubUsername: 'rdeforest' },
	{ githubUsername: 'hispanic' },
	{ githubUsername: 'github' },
	{ githubUsername: 'pleo-io' },
	{ githubUsername: 'mrhenry' },
	{ githubUsername: 'nermalcat69' },
	{ githubUsername: 'skunkteam' },
	// fetched manually from: https://www.patreon.com/members via bevry creator account
	// github associations performed manually
	{
		githubUsername: 'elliottditman',
		// from patreon:
		email: 'elliottditman@gmail.com',
		patreonId: '15026448',
	},
	{
		githubUsername: 'Armenm',
		// from patreon:
		nomen: 'Armen Mkrtchian',
		email: 'armen.mkrtchian@gmail.com',
		twitterUsername: 'armen_mkrtchian',
	},
	{
		githubUsername: 'leedriscoll',
		// from patreon:
		nomen: 'Lee Driscoll',
		email: 'lsdriscoll@icloud.com',
		patreonId: '5292556',
	},
	{
		githubUsername: 'Aglezabad',
		// from patreon:
		nomen: 'Ángel González',
		email: 'aglezabad@gmail.com',
		twitterUsername: 'Aglezabad',
	},
	{
		githubUsername: 'scokem',
		twitterUsername: 'scokem',
		// from patreon:
		nomen: 'Scott Kempson',
		email: 'scottkempson@gmail.com',
	},
]

export const hiddenConfigurationProperties = [
	'comment',
	'versions',
	'githubActionTestEnv',
]

// fill this with a map of dependency package names to versions that are busted
// so that if they are necessary, a previous version is used instead
export const bustedVersions = {}

export const allLanguages = [
	'typescript',
	'javascript',
	'coffeescript',
	'json',
	'react',
	'jsx',
	'mdx',
	'html',
	'css',
]

// both browsers and typescript lag behind
// as it is 2023-11-01 and ES2023 isn't available to typescript, even though it has been ratified (they get ratified in the middle of year)
const aYearAgo = getDateWithYearOffset(-1)

// we reverse, to make sure it is newest first
export const allTypescriptEcmascriptVersions = [
	'esnext',
	...getESVersionsByDate(aYearAgo).reverse().map(toLowerCase),
]

// we reverse, to make sure it is newest first
export const allEcmascriptVersions = [
	'esnext',
	...getESVersionsByNow().reverse().map(toLowerCase),
]

export const defaultCoffeeEcmascriptTarget = 'esnext'

export const possibleTargets = unique([
	...allLanguages,
	...allEcmascriptVersions,
])

// previous year
export const defaultBrowsersEcmascriptTarget = toLowerCase(
	getESVersionByDate(aYearAgo),
)

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	es2015: 'ES2015',
	es6: 'ES2015',
	es2016: 'ES2016',
	es7: 'ES2016',
	es2017: 'ES2017',
	es2018: 'ES2018',
	es2019: 'ES2019',
	es2020: 'ES2020',
	es2021: 'ES2021',
	es2022: 'ES2022',
	es2023: 'ES2023',
	es2024: 'ES2024',
	es2025: 'ES2025',
	es2026: 'ES2026',
	es2027: 'ES2027',
	coffeescript: 'CoffeeScript',
}
