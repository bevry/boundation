// builtin
import { cwd } from 'node:process'

// external
import {
	getESVersionsByDate,
	getESVersionByDate,
	getDateWithYearOffset,
} from '@bevry/ecmascript-versions'

export const pwd = cwd()

export const typesDir = 'compiled-types'

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
export const allTypescriptTargets = [
	'ESNext',
	...getESVersionsByDate(aYearAgo).reverse(),
]

export const defaultCoffeeTarget = 'ESNext'

// previous year
export const defaultBrowserTarget = getESVersionByDate(aYearAgo)

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
