// External
import * as pathUtil from 'path'
import * as fsUtil from 'fs'
import yaml from 'js-yaml'
import safeps from 'safeps'

// esm workarounds
import Errlop from 'errlop'

// Local
import { status } from './log.js'
import { pwd } from './data.js'

export function exists(file) {
	try {
		const path = pathUtil.resolve(pwd, file)
		return new Promise(function (resolve) {
			fsUtil.exists(path, function (exists) {
				console.log(path, exists ? 'does' : 'does not', 'exist')
				resolve(exists)
			})
		})
	} catch (err) {
		console.error({ err, pwd, file })
		return Promise.resolve(false)
	}
}

export async function echoExists(file) {
	const e = await exists(file)
	return e ? file : ''
}

export function unlink(file) {
	if (Array.isArray(file)) {
		return Promise.all(file.map((i) => unlink(i)))
	}
	const path = pathUtil.resolve(pwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.unlink(path, function (error) {
			if (error) {
				if (error.message && error.message.includes('ENOENT')) return resolve()
				return reject(error)
			}
			console.log(path, 'has been removed')
			return resolve()
		})
	})
}

export async function unlinkIfContains(file, what) {
	if (Array.isArray(file)) {
		return Promise.all(file.map((i) => unlinkIfContains(i, what)))
	}
	const path = pathUtil.resolve(pwd, file)
	if (await exists(path)) {
		if (await contains(path, what)) {
			console.log(path, 'will be removed because it contains:', what)
			return unlink(path)
		} else {
			console.log(
				path,
				'will not be removed because it does not contain:',
				what
			)
		}
	}
}

export function rmrf(files) {
	return exec(`rm -Rf ${files.join(' ')}`)
}

export function rmdir(file) {
	const path = pathUtil.resolve(pwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.rmdir(path, { recursive: true }, function (error) {
			if (error) {
				if (error.message && error.message.includes('ENOENT')) return resolve()
				return reject(error)
			}
			return resolve()
		})
	})
}

export function read(file) {
	const path = pathUtil.resolve(pwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.readFile(path, function (error, data) {
			if (error) return reject(error)
			return resolve(data)
		})
	})
}

export async function contains(file, data) {
	return (await read(file)).toString().includes(data)
}

export function rename(source, target) {
	source = pathUtil.resolve(pwd, source)
	target = pathUtil.resolve(pwd, target)
	return new Promise(function (resolve, reject) {
		fsUtil.rename(source, target, function (error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

export function write(file, data) {
	const path = pathUtil.resolve(pwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.writeFile(path, data, function (error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

export async function readJSON(file) {
	const exist = await exists(file)
	if (!exist) return {}
	const data = await read(file)
	return JSON.parse(data)
}

export async function readYAML(file) {
	const exist = await exists(file)
	if (!exist) return {}
	const data = await read(file)
	return yaml.load(data)
}

export function writeYAML(file, data) {
	return write(file, yaml.dump(data))
}

export function spawn(command, opts = {}) {
	opts.cwd = opts.cwd || pwd
	opts.stdio = opts.stdio == null ? 'inherit' : opts.stdio
	return new Promise(function (resolve, reject) {
		safeps.spawn(command, opts, function (err, stdout) {
			if (err)
				return reject(new Errlop(`spawn failed: ${command.join(' ')}`, err))
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
	const path = pathUtil.resolve(pwd, file)
	const basename = pathUtil.basename(path)
	status(`reading the ${basename} file...`)
	try {
		if (await exists(path)) {
			const data = JSON.parse(await read(path))
			status(`...read the ${basename} file...`)
			return data
		} else {
			status(`...missing the ${path} file...`)
		}
	} catch (err) {
		status(`...skipped the ${basename} file`)
		return null
	}
}
