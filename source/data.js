// builtin
import { cwd } from 'process'

// external
import {
	getAllESVersions,
	getESVersion,
	getDateWithYearOffset,
} from 'es-versions'

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

// @todo document why we reverse
export const allTypescriptTargets = ['ESNext', ...getAllESVersions().reverse()]

export const defaultCoffeeTarget = 'ESNext'

// previous year
export const defaultBrowserTarget = getESVersion(getDateWithYearOffset(-1))

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
