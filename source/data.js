// builtin
import { cwd } from 'process'

// external
import {
	getESVersionsByNow,
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

// we reverse, to make sure it is newest first
export const allTypescriptTargets = [
	'ESNext',
	...getESVersionsByNow().reverse(),
]

export const defaultCoffeeTarget = 'ESNext'

// previous year
export const defaultBrowserTarget = getESVersionByDate(
	getDateWithYearOffset(-1),
)

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
