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

export const allNodeVersions = [
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
]

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

export const allEsTargets = [
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

export const languageNames = {
	typescript: 'TypeScript',
	esnext: 'ESNext',
	es5: 'ES5',
	coffeescript: 'CoffeeScript',
}
