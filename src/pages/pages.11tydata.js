// Set to true for development environment, false for production. 
// When true, developers can see all posts 
// without having to manually change each post's front matter.
const isDevEnv = false


function showDraft(data) {
	const isDraft = 'draft' in data && data.draft !== false;

	return isDevEnv || !isDraft;
}

module.exports = {
	layout: "./layouts/page.html",
	eleventyComputed: {
		eleventyExcludeFromCollections: function(data) {
			if (showDraft(data)) {
				return data.eleventyExcludeFromCollections;
			} else {
				return true;
			}
		},
		permalink: function(data) {
			if(showDraft(data)) {
				return data.permalink;
			} else {
				return false;
			}
		}
		
	}
};