// builtin
import { resolve, basename } from 'node:path'
import { rename as _rename } from 'node:fs'

// external
import yaml from 'js-yaml'
import safeps from 'safeps'
import Errlop from 'errlop'
import { isAccessible } from '@bevry/fs-accessible'
import unlink from '@bevry/fs-unlink'
import read from '@bevry/fs-read'
import write from '@bevry/fs-write'

// local
import { status } from './log.js'
import { pwd } from './data.js'

export async function echoExists(file) {
	const e = await isAccessible(file)
	return e ? file : ''
}

export async function unlinkIfContains(file, what) {
	if (Array.isArray(file)) {
		return Promise.all(file.map((i) => unlinkIfContains(i, what)))
	}
	const path = resolve(pwd, file)
	if (await isAccessible(path)) {
		if (await contains(path, what)) {
			console.log(path, 'will be removed because it contains:', what)
			return unlink(path)
		} else {
			console.log(
				path,
				'will not be removed because it does not contain:',
				what,
			)
		}
	}
}

export async function contains(file, data) {
	return (await read(file)).toString().includes(data)
}

export function rename(source, target) {
	source = resolve(pwd, source)
	target = resolve(pwd, target)
	return new Promise(function (resolve, reject) {
		_rename(source, target, function (error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

export async function readJSON(file) {
	const exist = await isAccessible(file)
	if (!exist) return {}
	const data = await read(file)
	return JSON.parse(data)
}

export async function readYAML(file) {
	const exist = await isAccessible(file)
	if (!exist) return {}
	const data = await read(file)
	return yaml.load(data)
}

export function writeYAML(file, data) {
	return write(file, yaml.dump(data, { noRefs: true }))
}

export function spawn(command, opts = {}) {
	opts.cwd = opts.cwd || pwd
	opts.stdio = opts.stdio == null ? 'inherit' : opts.stdio
	return new Promise(function (resolve, reject) {
		safeps.spawn(command, opts, function (err, stdout = '', stderr = '') {
			if (err) {
				const message = `spawn failed: ${command.join(' ')}`
				if (stderr) {
					const errorMessage = stderr.toLowerCase()
					if (
						errorMessage.includes('enoent') ||
						errorMessage.includes('etarget') ||
						errorMessage.includes('timeout') ||
						errorMessage.includes('econn')
					) {
						console.log(
							'trying again due to poor internet connection or caching',
						)
						return spawn(command, opts).then(resolve).catch(reject)
					}
				}
				return reject(new Errlop(message, err))
			}
			return resolve(stdout)
		})
	})
}

export function exec(command, opts = {}) {
	opts.cwd = opts.cwd || pwd
	return new Promise(function (resolve, reject) {
		safeps.exec(command, opts, function (err, stdout) {
			if (err) return reject(new Errlop(`exec failed: ${command}`, err))
			return resolve(stdout)
		})
	})
}

export async function parse(file) {
	const path = resolve(pwd, file)
	const filename = basename(path)
	status(`reading the ${filename} file...`)
	try {
		if (await isAccessible(path)) {
			const data = JSON.parse(await read(path))
			status(`...read the ${filename} file...`)
			return data
		} else {
			status(`...missing the ${path} file...`)
		}
	} catch (err) {
		status(`...skipped the ${filename} file`)
		return null
	}
}
