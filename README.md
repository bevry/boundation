<!-- TITLE/ -->

# boundation

<!-- /TITLE -->

<!-- BADGES/ -->

<span class="badge-githubworkflow"><a href="https://github.com/bevry/boundation/actions?query=workflow%3Abevry" title="View the status of this project's GitHub Workflow: bevry"><img src="https://github.com/bevry/boundation/workflows/bevry/badge.svg" alt="Status of the GitHub Workflow: bevry" /></a></span>
<span class="badge-npmversion"><a href="https://npmjs.org/package/boundation" title="View this project on NPM"><img src="https://img.shields.io/npm/v/boundation.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/boundation" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/boundation.svg" alt="NPM downloads" /></a></span>
<br class="badge-separator" />
<span class="badge-githubsponsors"><a href="https://github.com/sponsors/balupton" title="Donate to this project using GitHub Sponsors"><img src="https://img.shields.io/badge/github-donate-yellow.svg" alt="GitHub Sponsors donate button" /></a></span>
<span class="badge-thanksdev"><a href="https://thanks.dev/u/gh/bevry" title="Donate to this project using ThanksDev"><img src="https://img.shields.io/badge/thanksdev-donate-yellow.svg" alt="ThanksDev donate button" /></a></span>
<span class="badge-liberapay"><a href="https://liberapay.com/bevry" title="Donate to this project using Liberapay"><img src="https://img.shields.io/badge/liberapay-donate-yellow.svg" alt="Liberapay donate button" /></a></span>
<span class="badge-buymeacoffee"><a href="https://buymeacoffee.com/balupton" title="Donate to this project using Buy Me A Coffee"><img src="https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg" alt="Buy Me A Coffee donate button" /></a></span>
<span class="badge-opencollective"><a href="https://opencollective.com/bevry" title="Donate to this project using Open Collective"><img src="https://img.shields.io/badge/open%20collective-donate-yellow.svg" alt="Open Collective donate button" /></a></span>
<span class="badge-crypto"><a href="https://bevry.me/crypto" title="Donate to this project using Cryptocurrency"><img src="https://img.shields.io/badge/crypto-donate-yellow.svg" alt="crypto donate button" /></a></span>
<span class="badge-paypal"><a href="https://bevry.me/paypal" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
<br class="badge-separator" />
<span class="badge-discord"><a href="https://discord.gg/nQuXddV7VP" title="Join this project's community on Discord"><img src="https://img.shields.io/discord/1147436445783560193?logo=discord&amp;label=discord" alt="Discord server badge" /></a></span>
<span class="badge-twitch"><a href="https://www.twitch.tv/balupton" title="Join this project's community on Twitch"><img src="https://img.shields.io/twitch/status/balupton?logo=twitch" alt="Twitch community badge" /></a></span>

<!-- /BADGES -->

<!-- DESCRIPTION/ -->

Automatic scaffolding and upgrading of your JavaScript ecosystem projects using Bevry's best practices

<!-- /DESCRIPTION -->


## Usage

Install the package globally on Node.js v12 or higher using `npm install --global boundation` then run `boundation` on your project or in an empty directory.

It will ask you several questions about your project, then initialise or upgrade the project with the latest Bevry best-practices.

## Features

-   Supports JavaScript, TypeScript, CoffeeScript, and Website projects
-   Automatic [Editions](https://github.com/bevry/editions) setup and upgrades for automatic selection of the best edition for the environment, allowing you to develop for the latest environment with the latest technology, then automatically test on and support older environments
    -   Automated edition generation so the one package can be used between Node.js, Web Browsers, and Deno where applicable
    -   Automated ES6 Import and CJS Require compatibility generation
    -   Automated compatible editions generated for Web Browsers, Node.js, Deno
    -   Each generated edition is targeted specifically for each version of each target that you intend to support, with each edition compatibility tested by [Testen](https://github.com/bevry/testen) and trimmed if redundant overlaps are present
-   Uses [Projectz](https://github.com/bevry/projectz) to automatically generate and maintain your readme, license, badges, and the contributing file
-   Automatically configures sensible defaults based on the features that your project is using, while maintaining support for your extensions and customisations, supports
    -   TSConfig for JavaScript and TypeScript projects
    -   ESLint for JavaScript and TypeScript projects
    -   Flow for JavaScript projects
    -   CoffeeLint for CoffeeSCript projects
    -   Zeit's Now and Next.js
    -   DocPad Plugins
-   Automatically gives you documentation generation and publishing for the following:
    -   TypeDoc for TypeScript projects
    -   JSDoc for JavaScript projects
    -   YUIDoc for new CoffeeScript projects, and Biscotto for older projects
-   Automated GitHub Actions setup and configuration for a variety of projects
-   Automated package dependency upgrades and migrations to compatible versions
-   Powerful NPM Scripts
    -   `npm run our:setup` for setting up the project for development
        -   automatic addition of your `my:setup:*` scripts
    -   `npm run our:compile` for compiling the project
        -   automatic addition of your `my:compile:*` scripts
    -   `npm run our:deploy` for linting
        -   automatic addition of your `my:deploy:*` scripts
    -   `npm run our:meta` for compiling the meta files
        -   automatic addition of your `my:meta:*` scripts
    -   `npm run our:verify` for linting and tests
        -   automatic addition of your `my:verify:*` scripts
    -   `npm run our:release` for for releasing your project
        -   on code projects, it will run verify, check for uncommitted changes, a changelog entry, performing the git tag automatically, and the git push
        -   on website projects, it will run verify and git push
        -   automatic addition of your `my:release:*` scripts

<!-- INSTALL/ -->

## Install

### [npm](https://npmjs.com "npm is a package manager for javascript")

#### Install Globally

-   Install: `npm install --global boundation`
-   Executable: `boundation`

#### Install Locally

-   Install: `npm install --save boundation`
-   Executable: `npx boundation`
-   Import: `import pkg from ('boundation')`
-   Require: `const pkg = require('boundation').default`

### [Editions](https://editions.bevry.me "Editions are the best way to produce and consume packages you care about.")

This package is published with the following editions:
-   `boundation` aliases `boundation/source/index.js`
-   `boundation/source/index.js` is [ESNext](https://en.wikipedia.org/wiki/ECMAScript#ES.Next "ECMAScript Next") source code for [Node.js](https://nodejs.org "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine") 18 || 20 || 21 with [Import](https://babeljs.io/docs/learn-es2015/#modules "ECMAScript Modules") for modules

<!-- /INSTALL -->

<!-- HISTORY/ -->

## History

[Discover the release history by heading on over to the `HISTORY.md` file.](https://github.com/bevry/boundation/blob/HEAD/HISTORY.md#files)

<!-- /HISTORY -->

<!-- BACKERS/ -->

## Backers

### Code

[Discover how to contribute via the `CONTRIBUTING.md` file.](https://github.com/bevry/boundation/blob/HEAD/CONTRIBUTING.md#files)

#### Authors

-   [Benjamin Lupton](https://balupton.com) — Accelerating collaborative wisdom.

#### Maintainers

-   [Benjamin Lupton](https://balupton.com) — Accelerating collaborative wisdom.

#### Contributors

-   [Benjamin Lupton](https://github.com/balupton) — [view contributions](https://github.com/bevry/boundation/commits?author=balupton "View the GitHub contributions of Benjamin Lupton on repository bevry/boundation")

### Finances

<span class="badge-githubsponsors"><a href="https://github.com/sponsors/balupton" title="Donate to this project using GitHub Sponsors"><img src="https://img.shields.io/badge/github-donate-yellow.svg" alt="GitHub Sponsors donate button" /></a></span>
<span class="badge-thanksdev"><a href="https://thanks.dev/u/gh/bevry" title="Donate to this project using ThanksDev"><img src="https://img.shields.io/badge/thanksdev-donate-yellow.svg" alt="ThanksDev donate button" /></a></span>
<span class="badge-liberapay"><a href="https://liberapay.com/bevry" title="Donate to this project using Liberapay"><img src="https://img.shields.io/badge/liberapay-donate-yellow.svg" alt="Liberapay donate button" /></a></span>
<span class="badge-buymeacoffee"><a href="https://buymeacoffee.com/balupton" title="Donate to this project using Buy Me A Coffee"><img src="https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg" alt="Buy Me A Coffee donate button" /></a></span>
<span class="badge-opencollective"><a href="https://opencollective.com/bevry" title="Donate to this project using Open Collective"><img src="https://img.shields.io/badge/open%20collective-donate-yellow.svg" alt="Open Collective donate button" /></a></span>
<span class="badge-crypto"><a href="https://bevry.me/crypto" title="Donate to this project using Cryptocurrency"><img src="https://img.shields.io/badge/crypto-donate-yellow.svg" alt="crypto donate button" /></a></span>
<span class="badge-paypal"><a href="https://bevry.me/paypal" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

#### Sponsors

-   [Andrew Nesbitt](https://nesbitt.io) — Software engineer and researcher
-   [Balsa](https://balsa.com) — We're Balsa, and we're building tools for builders.
-   [Codecov](https://codecov.io) — Empower developers with tools to improve code quality and testing.
-   [Frontend Masters](https://FrontendMasters.com) — The training platform for web app engineering skills – from front-end to full-stack! 🚀
-   [Mr. Henry](https://mrhenry.be)
-   [Poonacha Medappa](https://poonachamedappa.com)
-   [Rob Morris](https://github.com/Rob-Morris)
-   [Sentry](https://sentry.io) — Real-time crash reporting for your web apps, mobile apps, and games.
-   [Syntax](https://syntax.fm) — Syntax Podcast

#### Donors

-   [Andrew Nesbitt](https://nesbitt.io)
-   [Ángel González](https://univunix.com)
-   [Armen Mkrtchian](https://mogoni.dev)
-   [Balsa](https://balsa.com)
-   [Chad](https://opencollective.com/chad8)
-   [Codecov](https://codecov.io)
-   [dr.dimitru](https://veliovgroup.com)
-   [Elliott Ditman](https://elliottditman.com)
-   [entroniq](https://gitlab.com/entroniq)
-   [Frontend Masters](https://FrontendMasters.com)
-   [GitHub](https://github.com/about)
-   [Hunter Beast](https://cryptoquick.com)
-   [Jean-Luc Geering](https://github.com/jlgeering)
-   [Lee Driscoll](https://leedriscoll.me)
-   [Michael Duane Mooring](https://mdm.cc)
-   [Michael Harry Scepaniak](https://michaelscepaniak.com)
-   [Mohammed Shah](https://github.com/smashah)
-   [Mr. Henry](https://mrhenry.be)
-   [Nermal](https://arjunaditya.vercel.app)
-   [Pleo](https://pleo.io)
-   [Poonacha Medappa](https://poonachamedappa.com)
-   [Robert de Forest](https://github.com/rdeforest)
-   [Rob Morris](https://github.com/Rob-Morris)
-   [Scott Kempson](https://github.com/scokem)
-   [Sentry](https://sentry.io)
-   [ServieJS](https://github.com/serviejs)
-   [Skunk Team](https://skunk.team)
-   [Syntax](https://syntax.fm)
-   [WriterJohnBuck](https://github.com/WriterJohnBuck)

<!-- /BACKERS -->

<!-- LICENSE/ -->

## License

Unless stated otherwise all works are:

-   Copyright &copy; [Benjamin Lupton](https://balupton.com)

and licensed under:

-   [Artistic License 2.0](http://spdx.org/licenses/Artistic-2.0.html)

<!-- /LICENSE -->
