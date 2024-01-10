// builtin
import { cwd } from 'node:process'

// external
import {
	getESVersionsByDate,
	getESVersionByDate,
	getESVersionsByNow,
	getDateWithYearOffset,
} from '@bevry/ecmascript-versions'

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
	'esnext',
	'es5',
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
export const allTypescriptEcmascriptTargets = [
	'ESNext',
	...getESVersionsByDate(aYearAgo).reverse(),
]

// we reverse, to make sure it is newest first
export const allEcmascriptVersions = [
	'ESNext',
	...getESVersionsByNow().reverse(),
]

export const defaultCoffeeEcmascriptTarget = 'ESNext'

// previous year
export const defaultBrowserTarget = getESVersionByDate(aYearAgo)

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
