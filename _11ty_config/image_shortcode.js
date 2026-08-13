const path = require("node:path");
const fs = require("fs");
const Image = require("@11ty/eleventy-img");

const IMAGE_OPTIONS = {
	widths: [400, 800, 1280, 1600],
	formats: ["avif", "webp", "svg", "jpeg"],
	outputDir: "./_site/optimized/",
	urlPath: "/optimized/",
	// svgCompressionSize: "br",
};

/**
 * `propSrc` / `propAlt` turn the generated <img> into a CloudCannon image
 * editable region. The attributes go on the <img> itself rather than a wrapper
 * because several components place the image as a CSS grid item (in hero.scss
 * `.c-hero .c-image` is `grid-row: 1 / -1`) — an extra wrapper would become the
 * grid item and break the layout, while `display: contents` would leave the
 * region with no box for the editor's hover target.
 */
module.exports = async (srcFilePath, alt, className, sizes, preferSvg, propSrc, propAlt) => {
	let before = Date.now();
	let inputFilePath = srcFilePath == null ? srcFilePath : path.join("src", srcFilePath);

	const editableAttributes = propSrc
		? {
				"data-editable": "image",
				"data-prop-src": propSrc,
				...(propAlt ? { "data-prop-alt": propAlt } : {}),
			}
		: {};

	if (fs.existsSync(inputFilePath)) {
		let metadata = await Image(
			inputFilePath,
			Object.assign(
				{
					svgShortCircuit: preferSvg ? "size" : false,
				},
				IMAGE_OPTIONS,
			),
		);
		console.log(`[11ty/eleventy-img] ${Date.now() - before}ms: ${inputFilePath}`);

		return Image.generateHTML(metadata, {
			alt,
			class: className,
			sizes: sizes || "100vw", // Set default value to "100vw" if sizes is not provided
			loading: "eager",
			decoding: "async",
			...editableAttributes,
		});
	} else {
		const extra = Object.entries(editableAttributes)
			.map(([key, value]) => ` ${key}="${value}"`)
			.join("");
		return `<img class='${className}' src='${srcFilePath}' alt='${alt}'${extra}>`;
	}
};
