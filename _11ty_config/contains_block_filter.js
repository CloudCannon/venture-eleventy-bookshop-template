module.exports = (content_blocks, blockName) => {
    if (!Array.isArray(content_blocks)) {
      return false;
    }
    return content_blocks.some(block => block._bookshop_name === blockName);
}