'use strict'

// Prepare
const cwd = process.cwd()

// External
const pathUtil = require('path')
const fsUtil = require('fs')
const safeps = require('safeps')
const yaml = require('js-yaml')
const Errlop = require('errlop').default

// Local
const { status } = require('./log.js')

function exists(file) {
	try {
		const path = pathUtil.resolve(cwd, file)
		return new Promise(function (resolve) {
			fsUtil.exists(path, function (exists) {
				resolve(exists)
			})
		})
	} catch (err) {
		console.error({ err, cwd, file })
		return Promise.resolve(false)
	}
}

async function echoExists(file) {
	const e = await exists(file)
	return e ? file : ''
}

function unlink(file) {
	const path = pathUtil.resolve(cwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.unlink(path, function (error) {
			if (error) {
				if (error.message && error.message.includes('ENOENT')) return resolve()
				return reject(error)
			}
			return resolve()
		})
	})
}

function rmdir(file) {
	const path = pathUtil.resolve(cwd, file)
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

function read(file) {
	const path = pathUtil.resolve(cwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.readFile(path, function (error, data) {
			if (error) return reject(error)
			return resolve(data)
		})
	})
}

async function contains(file, data) {
	return (await read(file)).toString().includes(data)
}

function rename(source, target) {
	source = pathUtil.resolve(cwd, source)
	target = pathUtil.resolve(cwd, target)
	return new Promise(function (resolve, reject) {
		fsUtil.rename(source, target, function (error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

function write(file, data) {
	const path = pathUtil.resolve(cwd, file)
	return new Promise(function (resolve, reject) {
		fsUtil.writeFile(path, data, function (error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

async function readYAML(file) {
	const exist = await exists(file)
	if (!exist) return {}
	const data = await read(file)
	return yaml.load(data)
}

function writeYAML(file, data) {
	return write(file, yaml.dump(data))
}

function spawn(command, opts = {}) {
	opts.cwd = opts.cwd || cwd
	opts.stdio = opts.stdio == null ? 'inherit' : opts.stdio
	return new Promise(function (resolve, reject) {
		safeps.spawn(command, opts, function (err, stdout) {
			if (err)
				return reject(new Errlop(`spawn failed: ${command.join(' ')}`, err))
			return resolve(stdout)
		})
	})
}

function exec(command, opts = {}) {
	opts.cwd = opts.cwd || cwd
	return new Promise(function (resolve, reject) {
		safeps.exec(command, opts, function (err, stdout) {
			if (err) return reject(new Errlop(`exec failed: ${command}`, err))
			return resolve(stdout)
		})
	})
}

async function parse(file) {
	const path = pathUtil.resolve(cwd, file)
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

module.exports = {
	contains,
	exec,
	echoExists,
	exists,
	parse,
	read,
	readYAML,
	rename,
	rmdir,
	spawn,
	unlink,
	write,
	writeYAML,
}
