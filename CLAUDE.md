# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CYCAS is a static multi-page French-language website for a Senegalese preventive nutrition brand. There is no build system, framework, or package manager — all pages are plain HTML files served directly from the filesystem.

## Architecture

### Pages
- [index.html](index.html) — Home (hero, stats, founder quote, products preview, impact)
- [apropos.html](apropos.html) — About
- [nutrition.html](nutrition.html) — Nutrition advice cards, driven by `db.js`
- [produits.html](produits.html) — Product catalog
- [product.html](product.html) — Single product detail page (self-contained styles via `<style>` block)
- [detail.html](detail.html) — Nutrition card detail view (uses URL params to look up `nutritionDB` from `db.js`)
- [impact.html](impact.html) — Social impact
- [blog.html](blog.html) — Blog / news
- [contact.html](contact.html) — Contact form

### Data layer
[db.js](db.js) is the only JavaScript file and acts as the site's data layer. It exports two objects to the global scope:
- `rawNutritionData` — array of 25 nutrition tip objects (profile, meal type, title, description, recommended products, tags)
- `nutritionDB` — derived array that maps each tip to an illustration via `getIllustration()` keyword logic, and builds HTML `content` strings for the detail view

Pages that use `db.js` load it via `<script src="db.js"></script>` and access `nutritionDB` directly.

### Styling
A single [style.css](style.css) stylesheet is shared by all pages except `product.html`, which embeds its own `<style>` block. Key design tokens:
- Font: `Manrope` (Google Fonts), weights 200–600
- Background: `assets/bg.png` as a full-viewport fixed background with a dark overlay
- Inner sections use white/cream (`#FDFBF5`, `#ffffff`) backgrounds to create contrast
- Scroll animations use the class `reveal-on-scroll` + `IntersectionObserver` (inline `<script>` on each page)
- Pattern watermarks (`.pattern-watermark`) are absolutely-positioned decorative circles using `assets/bg.png`

### Assets
```
assets/
  bg.png                          # Global background texture
  Maimouna.png                    # Founder photo
  produits/                       # Product images (Moulynak, Farine de mil, Marmite)
  illustrations/                  # Section-specific SVG/PNG illustrations
  db/cycas_nutrition_conseils.json # Source data (db.js was generated from this)
```

## Key Conventions

- All text is in **French**.
- Navigation is duplicated manually on each HTML page — update all pages when adding/removing nav items.
- `product.html` is currently a static template (not dynamically populated from `db.js`); product links on other pages all point to it regardless of which product is clicked.
- Illustration selection in `db.js` is keyword-based (see `getIllustration()`); new nutrition entries will auto-resolve to one of four illustrations based on keywords in their title/tags/description.
- There is no local dev server requirement — open any `.html` file directly in a browser or use VS Code Live Server.
