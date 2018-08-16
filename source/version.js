'use strict'

// Compare to versions simplify
// Works for 1, 1.1, or 1.1.1, or 1.1.1 - sadasd
function versionComparator (a, b) {
	// https://github.com/substack/versionComparator-compare/pull/4
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

module.exports = { versionComparator }
