'use strict'

module.exports.semver = function semver (a, b) {
	// https://github.com/substack/semver-compare/pull/4
	const pa = a.split('.')
	const pb = b.split('.')
	for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
		const na = Number(pa[i])
		const nb = Number(pb[i])
		if (na > nb) return 1
		if (nb > na) return -1
		if (!isNaN(na) && isNaN(nb)) return 1
		if (isNaN(na) && !isNaN(nb)) return -1
	}
	return 0
}
