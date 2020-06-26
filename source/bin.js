#!/usr/bin/env node

// External
import { resolve, join, dirname } from 'path'
import e from 'errlop'
const Errlop = e.default

// get root with imports
import url from 'url'
const root = resolve(dirname(url.fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')

// Internal
import { readJSON } from './fs.js'
import boundation from './index.js'
import state from './state.js'
import { pwd } from './data.js'

// Process unhandled rejections
process.on('unhandledRejection', function unhandledRejection(error) {
	console.error(new Errlop('An unhandled promise failed', error))
	process.exit(-1)
})

async function main() {
	// boundation
	const { version } = await readJSON(pkgPath)
	console.log(`Boundation v${version} [${root}]`)

	// app
	console.log(`Running on [${pwd}]`)

	// run
	boundation(state)
}

main()
