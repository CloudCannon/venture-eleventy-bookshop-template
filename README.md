# Venture

Venture is a polished, marketing website template for Eleventy. Browse through a [live demo](https://spiky-polar.cloudvent.net).

![Small business template screenshot](/src/assets/images/_screenshot.png)

[![Deploy to CloudCannon](https://buttons.cloudcannon.com/deploy.svg)](https://app.cloudcannon.com/register#sites/connect/github/CloudCannon/small-business-template-eleventy)

## Features

- Pre-built pages
- Pre-styled components
- Configurable navigation and footer
- Multiple hero options
- Configurable form, gallery, image, video, pricing, left/right block, and more components
- Generic "Embed" component for custom embeds
- Configurable theme colors
- Configurable fonts
- Optimized for editing in CloudCannon
- Responsive layouts

## Editing

Venture is set up for adding, updating and removing pages, components, posts, navigation and footer elements in [CloudCannon](https://app.cloudcannon.com/).

Changes in the data files require the site to be rebuilt to see your changes.

### Nav/footer details

- Reused around the site to save multiple editing locations.
- Set in the *Data* / *Nav* and *Data* / *Footer* sections
- Changes in these files are not reflected in live editing - you must save to see the changes in page building

### SEO details and favicon

- Favicon and site SEO details are set in the *Data* / *SEO* section
- Page SEO details are set in the frontmatter for each page (if they aren't set the site SEO details are used by default)

### Theme colors and fonts

- Theme colors and fonts can be set in *Data* / *Theme*
- The colors will update on the next build
- More font options can be added in *Data* / *Fonts*

## Setup

Get a workflow going to see your site's output (with [CloudCannon](https://app.cloudcannon.com/) or locally).

## Local quickstart

1. Run `npm i` to install the modules.
2. Run `npm run start` to run the project. This will create a `_site` folder, where all the developed files will remain.

By default the site will be at `http://localhost:8080`

## Components

Venture is built using Bookshop components. Bookshop is a framework that allows you to use component architecture in your static site, and enables live editing in CloudCannon. You can read more about Bookshop and how it integrates with Eleventy [here](https://cloudcannon.com/documentation/guides/bookshop-eleventy-guide/).

### /components page

Within Venture, there is a `components.html` page that allows you to use a feature of Bookshop called Bookshop Browser. When developing locally, you can use `localhost:8080/components` to preview your Bookshop components in the context of your site. This `/components` page is for local development only, and will not show up in CloudCannon or on your live site.

## Forms

You can use the "Form" component to create a form with a range of inputs. This component is set up to submit to a CloudCannon inbox as long as you configure the inbox key following the instructions below. If you want to integrate your custom form with custom submission actions you can use the "Embed" component.

- Create an inbox for your organisation/site following [these instructions](https://cloudcannon.com/documentation/articles/creating-an-inbox-to-receive-your-forms/) - note down the key that you use
- Connect your site to your inbox following [these instructions](https://cloudcannon.com/documentation/articles/connecting-your-site-to-an-inbox/)
- Add a "Form" and "Form Builder" component
- Add your inbox key to the relevant field in the form builder

The "Form" component has validation and error messages build in.

## Image optimization

The site uses the [eleventy image plugin](https://www.11ty.dev/docs/plugins/image/) to optimize your images.

To keep build times short you can set preserved paths for your image optimizations by setting preserved paths following the instructions below:

1. Within your site on CloudCannon navigate to Site Settings (found at the bottom of the site sidebar)

2. Navigate to the configuration tab

3. Open "caching options"

4. Add `node_modules/,_site/optimized/` to the preserved paths section

This will mean that only new/updated images get optimized on build.

See [this blog](https://cloudcannon.com/blog/automatically-optimize-your-images-with-eleventy-image-and-cloudcannon/) for more on optimizing images with Eleventy and CloudCannon.

## Embedding content

- The "Embed" component is built to be generic and support any embed, however we cannot guarantee it will work seemlessly with all embeddable content.
- We recommend using other components to check if they can meet your requirements first.
- We have succesfully tested the following embeds:
    - Google forms
    - Hubspot forms
    - Instagram
    - Spotify
    - X (formerly Twitter)
    - Google docs
    - YouTube video (although we would recommend using the "Centered Large Asset" component with a video instead)
    - Lottie files
    - PDFs

All options in the above list (except YouTube videos) require you to use the "Embed" component.

## Accessibility

We have made efforts to prioritize accessibility in our design, but we acknowledge that it may not be perfect. Your feedback is valuable to us, so please feel free to share any suggestions or concerns to help us improve accessibility further.

## Component links

All blocks have an id field that can be set and then used as a link to that component. 

This is helpful (for example) if you want to link to information about your services from the nav without having a fully seperate page for it. You can set the id field in the services block to be `services` and then in *Data* / *Nav* you can have a link to `#services`.

## Development

### Prebuild

There is a prebuild step with this template to process the user-defined theme variables (such as `color_groups` or `fonts`, defined in `src/_data/theme.yml`) and create associated CSS variables. The file which does this processing is located at `utils/fetch-theme-variables.js`.

When developing locally, you can run `$ npm run fetch-theme-variables` to execute the preprocessing. This command also runs automatically as part of `$ npm run start`.

Deploying your site to CloudCannon, there is a file located at `.cloudcannon/prebuild` which contains necessary commands to run before the build step, including `$ npm run fetch-theme-variables`.
