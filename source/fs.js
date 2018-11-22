'use strict'

// Prepare
const cwd = process.cwd()

// External
const pathUtil = require('path')
const fsUtil = require('fs')
const safeps = require('safeps')

function exists(file) {
	file = pathUtil.resolve(cwd, file)
	return new Promise(function(resolve) {
		fsUtil.exists(file, function(exists) {
			resolve(exists)
		})
	})
}

function unlink(file) {
	file = pathUtil.resolve(cwd, file)
	return new Promise(function(resolve, reject) {
		fsUtil.unlink(file, function(error) {
			if (error) {
				if (error.message && error.message.has('ENOENT')) return resolve()
				return reject(error)
			}
			return resolve()
		})
	})
}

function read(file) {
	file = pathUtil.resolve(cwd, file)
	return new Promise(function(resolve, reject) {
		fsUtil.readFile(file, function(error, data) {
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
	return new Promise(function(resolve, reject) {
		fsUtil.rename(source, target, function(error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

function write(file, data) {
	file = pathUtil.resolve(cwd, file)
	return new Promise(function(resolve, reject) {
		fsUtil.writeFile(file, data, function(error) {
			if (error) return reject(error)
			return resolve()
		})
	})
}

function spawn(command, opts = {}) {
	opts.cwd = opts.cwd || cwd
	opts.stdio = opts.stdio || 'inherit'
	return new Promise(function(resolve, reject) {
		safeps.spawn(command, opts, function(err, stdout) {
			if (err) return reject(err)
			return resolve(stdout)
		})
	})
}

function exec(command, opts = {}) {
	opts.cwd = opts.cwd || cwd
	return new Promise(function(resolve, reject) {
		safeps.exec(command, opts, function(err, stdout) {
			if (err) return reject(err)
			return resolve(stdout)
		})
	})
}

module.exports = { exists, unlink, read, rename, write, spawn, exec, contains }
