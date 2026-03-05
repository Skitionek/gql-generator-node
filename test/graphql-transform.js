const loader = require('graphql-tag/loader');

module.exports = {
	process(src) {
		return { code: loader.call({ cacheable() {} }, src) };
	},
};
