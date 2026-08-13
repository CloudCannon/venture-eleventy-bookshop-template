# Editing this site

A guide for editors working in CloudCannon. No code required.

> **This is a template.** Everything you see — headings, images, prices, contact details — is
> placeholder content, there to show you what each component can do. Replace it as you go. If a
> section doesn't suit your business, delete it; nothing depends on it being there.

---

## The two places you edit

| Where | What lives there | When you see the change |
| --- | --- | --- |
| **Pages** | Every page and all its content | Immediately, in the visual editor |
| **Data** | Settings shared across the whole site | After you save and the site rebuilds |

Anything under **Data** is reused in many places at once, which is why it can't update live. Change
your logo once and every page picks it up — but you'll need to save and wait for the rebuild to see
it.

---

## Building a page

Each page has two parts, and they're deliberately separate.

### 1. The hero

The band at the very top. It holds your page's main headline — the most important text on the page,
both for readers and for search engines. **Every page should have one.**

Two options:

- **Hero** — headline, description, button, and an image that can sit left, right, or fill the whole
  background
- **Hero - Simple** — headline and description only, centred or left-aligned

If you leave the hero empty, the page falls back to showing just the page title. That works, but it
can't be edited on the page itself, so you're better off adding a real hero.

### 2. Content blocks

Everything below the hero. Add, reorder and delete these freely:

| Block | Use it for |
| --- | --- |
| **Text block with image** | A paragraph beside a picture — the workhorse block |
| **Simple Text Block** | Longer writing with no image, e.g. terms or FAQs |
| **Icon Cards** | Three or more short points, each with an icon |
| **Image Cards** | The same, but with photos instead of icons |
| **Price List** | Services or packages with prices |
| **Testimonial** | A customer quote |
| **Image Gallery** | A grid of photos |
| **Centered Large Asset** | One big image or a YouTube video |
| **Contact** | Contact details plus a map |
| **Labelled Icons** | A row of icons with short labels |
| **Form** | A contact or booking form (see below) |
| **Embed** | Anything from another service that the blocks above don't cover |

---

## Colours

Every block has a **colour group** — a coordinated set of background, text and button colours. Pick
from the groups defined in **Data › Theme**; you're choosing a whole palette, not individual
colours, so blocks stay consistent.

Alternating colour groups down a page is an easy way to separate sections visually.

To change the palettes themselves, or add your own, edit **Data › Theme**. Colours appear after the
next build.

---

## Site-wide settings

| Setting | Where |
| --- | --- |
| Menu links | **Data › Nav** |
| Footer links and text | **Data › Footer** |
| Site name, description, social links | **Data › Site** |
| Colours and fonts | **Data › Theme** |
| Extra font choices | **Data › Fonts** |

For fonts, use any name from [Google Fonts](https://fonts.google.com/).

---

## Search engine details

Each page has its own **page description** and **featured image**, used when the page is shared or
listed in search results. Leave them empty and the site-wide defaults from **Data › Site** are used
instead — so you only need to fill them in where a page deserves something specific.

---

## Forms

The **Form** block submits to a CloudCannon inbox. It needs setting up once:

1. Create an inbox and note its key —
   [instructions](https://cloudcannon.com/documentation/articles/creating-an-inbox-to-receive-your-forms/)
2. Connect this site to it —
   [instructions](https://cloudcannon.com/documentation/articles/connecting-your-site-to-an-inbox/)
3. Paste the inbox key into the form's **inbox key** field

Then build the form from the available fields: text, email, phone, date, time, select, checkbox and
radio groups, country, text area, plus section headings and breaks to organise longer forms.

Mark a field **required** to make it compulsory, and use **helper text** for guidance like
*"Weekends only"*. Validation and error messages are already handled.

---

## Linking to a section

Every block has an **id** field. Type something short and lowercase like `services`, then link to
`#services` from your menu or a button.

This is how you point at part of a page without building a whole new one — useful for a services or
pricing section that lives on the homepage.

---

## Two things that surprise people

**The gallery shows every photo while editing.** On the live site it shows 6 on desktop or 3 on
mobile, with a *Load more* button. The editor deliberately shows them all so you can rearrange them.

**Draft hides a page.** Switch **draft** on and the page stays in CloudCannon but disappears from the
live site — handy for writing something before you're ready to publish.

---

## If something looks wrong

- **A change isn't showing** — if it was in **Data**, save and wait for the rebuild
- **Colours look off** — colour changes need a build; check **Data › Theme** for the group you picked
- **A field looks empty when it shouldn't be** — save the page and reopen it

Still stuck? [CloudCannon's documentation](https://cloudcannon.com/documentation/) covers the editing
interface itself, and your developer owns the components.
