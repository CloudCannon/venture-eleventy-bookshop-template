const editableRegions = require("@cloudcannon/editable-regions/eleventy");
const yaml = require("js-yaml");
const svgContents = require("eleventy-plugin-svg-contents");
const esbuild = require('esbuild');

/* 11ty config imports */
const image_shortcode = require('./_11ty_config/image_shortcode')
const military_time = require('./_11ty_config/military_time_filter')
const assign_local_liquid_tag = require('./_11ty_config/assign_local_liquid_tag')
const contains_block_filter = require('./_11ty_config/contains_block_filter')

const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt({
    html: true,
  });

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/uploads");
  eleventyConfig.addPassthroughCopy("css")
  // Data extensions
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));
  eleventyConfig.addDataExtension("yml", (contents) => yaml.load(contents));

  // Custom shortcodes
  eleventyConfig.addShortcode("image", image_shortcode);

  // Filters
  eleventyConfig.addFilter("markdownify", (markdown) => md.render(markdown));
  eleventyConfig.addFilter("ymlify", (yml) => yaml.load(yml));
  eleventyConfig.addFilter("militaryTime", military_time);
  eleventyConfig.addFilter('contains_block', contains_block_filter);

  // Tags
  eleventyConfig.addLiquidTag('assign_local', assign_local_liquid_tag);

  // Plugins.
  //
  // IMPORTANT: every addFilter/addShortcode/addLiquidTag above must stay ABOVE
  // this point. The editable-regions browser bundle mirrors this config by
  // replaying it, and stubbed modules throw when called. The replay is wrapped
  // in a single try/catch, so the first throw silently skips every remaining
  // registration -- helpers declared after a plugin would be missing in the
  // Visual Editor while `npm run build` stayed green.
  eleventyConfig.addPlugin(svgContents);
  eleventyConfig.addPlugin(editableRegions, {
    liquid: {
      // Stubbed in the browser bundle: these reach Node/native APIs. Node
      // built-ins and @11ty/eleventy(/*) are stubbed automatically, but
      // @11ty/eleventy-img matches neither pattern and must be listed.
      browserStub: [
        "@11ty/eleventy-img", // pulls in sharp
        "esbuild",            // build-only, invoked from eleventy.before
      ],
    },
  });

  // esbuild
  eleventyConfig.addWatchTarget('./src/assets/js/**');
  eleventyConfig.on('eleventy.before', async () => {
    await esbuild.build({
      entryPoints: ['src/assets/js/**'],
      outdir: '_site/assets/js',
      bundle: true,
      minify: true,
      sourcemap: true,
    });
  });

  return {
      dir: {
          input: "src",
          output: "_site"
      }
  }
}
