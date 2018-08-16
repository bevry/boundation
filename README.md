<!-- TITLE/ -->

<h1>boundation</h1>

<!-- /TITLE -->


<!-- BADGES/ -->

<span class="badge-travisci"><a href="http://travis-ci.org/bevry/boundation" title="Check this project's build status on TravisCI"><img src="https://img.shields.io/travis/bevry/boundation/master.svg" alt="Travis CI Build Status" /></a></span>
<span class="badge-npmversion"><a href="https://npmjs.org/package/boundation" title="View this project on NPM"><img src="https://img.shields.io/npm/v/boundation.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/boundation" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/boundation.svg" alt="NPM downloads" /></a></span>
<span class="badge-daviddm"><a href="https://david-dm.org/bevry/boundation" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/bevry/boundation.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/bevry/boundation#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/bevry/boundation.svg" alt="Dev Dependency Status" /></a></span>
<br class="badge-separator" />
<span class="badge-patreon"><a href="https://patreon.com/bevry" title="Donate to this project using Patreon"><img src="https://img.shields.io/badge/patreon-donate-yellow.svg" alt="Patreon donate button" /></a></span>
<span class="badge-opencollective"><a href="https://opencollective.com/bevry" title="Donate to this project using Open Collective"><img src="https://img.shields.io/badge/open%20collective-donate-yellow.svg" alt="Open Collective donate button" /></a></span>
<span class="badge-flattr"><a href="https://flattr.com/profile/balupton" title="Donate to this project using Flattr"><img src="https://img.shields.io/badge/flattr-donate-yellow.svg" alt="Flattr donate button" /></a></span>
<span class="badge-paypal"><a href="https://bevry.me/paypal" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
<span class="badge-bitcoin"><a href="https://bevry.me/bitcoin" title="Donate once-off to this project using Bitcoin"><img src="https://img.shields.io/badge/bitcoin-donate-yellow.svg" alt="Bitcoin donate button" /></a></span>
<span class="badge-wishlist"><a href="https://bevry.me/wishlist" title="Buy an item on our wishlist for us"><img src="https://img.shields.io/badge/wishlist-donate-yellow.svg" alt="Wishlist browse button" /></a></span>
<br class="badge-separator" />
<span class="badge-slackin"><a href="https://slack.bevry.me" title="Join this project's slack community"><img src="https://slack.bevry.me/badge.svg" alt="Slack community badge" /></a></span>

<!-- /BADGES -->


<!-- DESCRIPTION/ -->

Automatic scaffolding and upgrading of your JavaScript ecosystem projects using Bevry's best practices

<!-- /DESCRIPTION -->


<!-- INSTALL/ -->

<h2>Install</h2>

<a href="https://npmjs.com" title="npm is a package manager for javascript"><h3>NPM</h3></a><ul>
<li>Install: <code>npm install --global boundation</code></li>
<li>Executable: <code>boundation</code></li></ul>

<h3><a href="https://github.com/bevry/editions" title="Editions are the best way to produce and consume packages you care about.">Editions</a></h3>

<p>This package is published with the following editions:</p>

<ul><li><code>boundation</code> aliases <code>boundation/source/index.js</code></li>
<li><code>boundation/source/index.js</code> is Source + <a href="https://babeljs.io/docs/learn-es2015/" title="ECMAScript Next">ESNext</a> + <a href="https://nodejs.org/dist/latest-v5.x/docs/api/modules.html" title="Node/CJS Modules">Require</a></li></ul>

<p>Older environments may need <a href="https://babeljs.io/docs/usage/polyfill/" title="A polyfill that emulates missing ECMAScript environment features">Babel's Polyfill</a> or something similar.</p>

<!-- /INSTALL -->


## Usage

Install the package globally. Then run `boundation` on your project or in an empty directory.

It will ask you several questions about your project, then initialise or upgrade the project with the latest Bevry best-practices.

If you have the `secret env` command available, you can preload `boundation` with the following usage:

``` bash
secret env GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET NPM_AUTHTOKEN TRAVIS_NOTIFICATION_EMAIL SURGE_LOGIN SURGE_TOKEN NOW_TOKEN -- boundation
```


## Features

- Supports JavaScript, CoffeeScript, and Website projects, more project types to come
- Automatic [Editions](https://github.com/bevry/editions) setup and upgrades for automatic selection of the best edition for the environment, allowing you to develop for the latest environment with the latest technology, then automatically test on and support older environments
- Uses [Projectz](https://github.com/bevry/projectz) to automatically generate and maintain your readme, license, badges, and the contributing file
- Uses [Bevry's Base Files](https://github.com/bevry/base) which provides linting configurations that automatically detect the features of your projects, and adjusts the linting accordingly, as well as pulling down files like `.gitignore` and `.npmignore` with respect for custom sections
- ESLint for JavaScript projects, and CoffeeLint for CoffeeScript projects
- Powerful NPM Scripts
    - `npm run our:setup` for setting up the project for development
        - automatic addition of your `my:setup:*` scripts
    - `npm run our:compile` for compiling the project
        - automatic addition of your `my:compile:*` scripts
    - `npm run our:deploy` for linting
        - automatic addition of your `my:deploy:*` scripts
    - `npm run our:meta` for compiling the meta files
        - automatic addition of your `my:meta:*` scripts
    - `npm run our:verify` for linting and tests
        - automatic addition of your `my:verify:*` scripts
    - `npm run our:release` for for releasing your project
        - on code projects, it will run verify, check for uncommitted changes, a changelog entry, performing the git tag automatically, and the git push
        - on website projects, it will run verify and git push
        - automatic addition of your `my:release:*` scripts
- Optional automatic Travis CI setup to release your project to npm when tests pass, and to test on older environments
    - Powered by [Awesome Travis](https://github.com/bevry/awesome-travis)
- Optional DocumentationJS for JavaScript projects
- Optional YUIDoc for new CoffeeScript projects, and Biscotto for old
- Optional Flow Type for type checking of JavaScript projects
- Optional ES6 Import module support
- Optional Babel support for older porjects
- Optional DocPad Plugin support
- Automatic package dependency upgrades


<!-- HISTORY/ -->

<h2>History</h2>

<a href="https://github.com/bevry/boundation/blob/master/HISTORY.md#files">Discover the release history by heading on over to the <code>HISTORY.md</code> file.</a>

<!-- /HISTORY -->


<!-- CONTRIBUTE/ -->

<h2>Contribute</h2>

<a href="https://github.com/bevry/boundation/blob/master/CONTRIBUTING.md#files">Discover how you can contribute by heading on over to the <code>CONTRIBUTING.md</code> file.</a>

<!-- /CONTRIBUTE -->


<!-- BACKERS/ -->

<h2>Backers</h2>

<h3>Maintainers</h3>

These amazing people are maintaining this project:

<ul><li><a href="http://balupton.com">Benjamin Lupton</a> — <a href="https://github.com/bevry/boundation/commits?author=balupton" title="View the GitHub contributions of Benjamin Lupton on repository bevry/boundation">view contributions</a></li></ul>

<h3>Sponsors</h3>

No sponsors yet! Will you be the first?

<span class="badge-patreon"><a href="https://patreon.com/bevry" title="Donate to this project using Patreon"><img src="https://img.shields.io/badge/patreon-donate-yellow.svg" alt="Patreon donate button" /></a></span>
<span class="badge-opencollective"><a href="https://opencollective.com/bevry" title="Donate to this project using Open Collective"><img src="https://img.shields.io/badge/open%20collective-donate-yellow.svg" alt="Open Collective donate button" /></a></span>
<span class="badge-flattr"><a href="https://flattr.com/profile/balupton" title="Donate to this project using Flattr"><img src="https://img.shields.io/badge/flattr-donate-yellow.svg" alt="Flattr donate button" /></a></span>
<span class="badge-paypal"><a href="https://bevry.me/paypal" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
<span class="badge-bitcoin"><a href="https://bevry.me/bitcoin" title="Donate once-off to this project using Bitcoin"><img src="https://img.shields.io/badge/bitcoin-donate-yellow.svg" alt="Bitcoin donate button" /></a></span>
<span class="badge-wishlist"><a href="https://bevry.me/wishlist" title="Buy an item on our wishlist for us"><img src="https://img.shields.io/badge/wishlist-donate-yellow.svg" alt="Wishlist browse button" /></a></span>

<h3>Contributors</h3>

These amazing people have contributed code to this project:

<ul><li><a href="http://balupton.com">Benjamin Lupton</a> — <a href="https://github.com/bevry/boundation/commits?author=balupton" title="View the GitHub contributions of Benjamin Lupton on repository bevry/boundation">view contributions</a></li></ul>

<a href="https://github.com/bevry/boundation/blob/master/CONTRIBUTING.md#files">Discover how you can contribute by heading on over to the <code>CONTRIBUTING.md</code> file.</a>

<!-- /BACKERS -->


<!-- LICENSE/ -->

<h2>License</h2>

Unless stated otherwise all works are:

<ul><li>Copyright &copy; 2017+ <a href="http://bevry.me">Bevry</a></li></ul>

and licensed under:

<ul><li><a href="http://spdx.org/licenses/MIT.html">MIT License</a></li></ul>

<!-- /LICENSE -->
