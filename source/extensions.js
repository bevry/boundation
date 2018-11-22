/* eslint no-extend-native:0 */
'use strict'

// Local
const { unhandledRejection } = require('./error')

// unhandledRejection
process.on('unhandledRejection', unhandledRejection)

// Prototype Extensions
String.prototype.has = function stringHas(value) {
	return this.indexOf(value) !== -1
}
String.prototype.hasnt = function stringHasnt(value) {
	return this.indexOf(value) === -1
}
Array.prototype.has = function arrayHas(value) {
	return this.indexOf(value) !== -1
}
Array.prototype.hasnt = function arrayHasnt(value) {
	return this.indexOf(value) === -1
}
Array.prototype.without = function arrayWithout(blacklist) {
	return this.filter(value => blacklist.hasnt(value))
}
