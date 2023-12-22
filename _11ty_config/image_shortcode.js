const path = require("node:path");
const fs = require('fs'); 
const Image = require("@11ty/eleventy-img");

const IMAGE_OPTIONS = {
	widths: [400, 800, 1280, 1600],
	formats: ["avif", "webp", "svg", "jpeg"],
	outputDir: "./_site/optimized/",
	urlPath: "/optimized/",
	// svgCompressionSize: "br",
};

module.exports = async (srcFilePath, alt, className, sizes, preferSvg) => {
    let before = Date.now();
    let inputFilePath = srcFilePath == null ? srcFilePath : path.join('src', srcFilePath);

    if (fs.existsSync(inputFilePath)) {
      let metadata = await Image(inputFilePath, Object.assign({
        svgShortCircuit: preferSvg ? "size" : false,
      }, IMAGE_OPTIONS));
      console.log( `[11ty/eleventy-img] ${Date.now() - before}ms: ${inputFilePath}` );

      return Image.generateHTML(metadata, {
        alt,
        class: className,
        sizes: sizes || "100vw", // Set default value to "100vw" if sizes is not provided
        loading: "eager",
        decoding: "async",
      });
    } else {
      return `<img class='${className}' src='${srcFilePath}' alt='${alt}'>`;
    }
  }