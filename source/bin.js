#!/usr/bin/env node

// builtin
import { resolve, join } from 'node:path'

// get root with imports
import filedirname from 'filedirname'
const [file, dir] = filedirname()
const root = resolve(dir, '..')
const pkgPath = join(root, 'package.json')

// internal
import { readJSON } from './fs.js'
import boundation from './index.js'
import state from './state.js'
import { pwd } from './data.js'

// // Process unhandled rejections
// process.on('unhandledRejection', function unhandledRejection(error) {
// 	console.error(new Errlop('An unhandled promise failed', error))
// 	process.exit(-1)
// })

async function main() {
	// boundation
	const { version } = await readJSON(pkgPath)
	console.log(`Boundation v${version} [${root}]`)

	// app
	console.log(`Running on [${pwd}]`)

	// run
	await boundation(state)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
