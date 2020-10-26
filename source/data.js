// External
import { cwd } from 'process'

export const pwd = cwd()

export const typesDir = 'compiled-types'

// fill this with a map of dependency package names to versions that are busted
// so that if they are necessary, a previous verison is used instead
export const bustedVersions = {}

export const bevryOrganisationsList = 'balupton bevry bevry-trading docpad browserstate webwrite chainyjs interconnectapp'.split(
	' '
)

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

export const allLanguagesLowercase = allLanguages.map((i) => i.toLowerCase())

export const allTypescriptTargets = [
	'ESNext',
	'ES2020',
	'ES2019',
	'ES2018',
	'ES2017',
	'ES2016',
	'ES2015',
	'ES5',
	'ES3',
]

export const allTypescriptTargetsLowercase = allTypescriptTargets.map((i) =>
	i.toLowerCase()
)

/** Which typescript targets apply to the latest current node release? */
export const currentTypescriptTargets = ['ESNext', 'ES2020', 'ES2019']

/** Which typescript targets apply to the latest active node LTS release? */
export const activeTypescriptTargets = ['ESNext', 'ES2020', 'ES2019', 'ES2018']

export const defaultCoffeeTarget = 'ESNext'

// previous year
export const defaultBrowserTarget = 'ES' + (new Date().getFullYear() - 1)

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
