/**
 * True when any page-builder block is of the given type.
 * `blockName` is a component include path, e.g. "components/sections/gallery/gallery".
 */
module.exports = (content_blocks, blockName) => {
	if (!Array.isArray(content_blocks)) {
		return false;
	}

	return content_blocks.some((block) => block._type === blockName);
};
