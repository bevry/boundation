// builtin
import { cwd } from 'process'

// local
import { getAllESVersions, getESVersion } from './es-versions.js'

export const pwd = cwd()

export const typesDir = 'compiled-types'

// fill this with a map of dependency package names to versions that are busted
// so that if they are necessary, a previous verison is used instead
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

export const allTypescriptTargets = getAllESVersions()

export const defaultCoffeeTarget = 'ESNext'

// previous year
export const defaultBrowserTarget = getESVersion(-1)

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
