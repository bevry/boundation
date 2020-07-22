# History

## v1.65.3 2020 July 22

-   fixed fetching the default entry filename (regression since v1.62.0)
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.65.2 2020 July 22

-   fixed automated dependencies being saved as dev dependencies, and automated dev dependencies not being updated (regression since v1.64.0)
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.65.1 2020 July 22

-   delete the `package.json:type` when we cannot determine what it should be
-   correct handling of mjs, cjs, and js files
-   fix application of `bin` permissions
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.65.0 2020 July 3

-   move from `.cjs` and `.mjs` index files, to [`package.json:exports`](https://nodejs.org/api/esm.html#esm_conditional_exports)
    -   if compiled-types exists, use that for the type information in the auto-loader
-   package manager default changed from `yarn` back to `npm` - npm was swapped to yarn in v1.63.0

## v1.64.0 2020 June 26

-   boundation is now coded in ESM instead of CJS
-   exact dependencies are now changed to the `^` range
    -   this can overidden by specifying any exact versions inside `package.json:boundation.versions`
-   now we generate ESM editions for node.js, and do the `cjs` and `mjs` magic
    -   this is because esm modules compiled to cjs do not do `export default` but `export { default }` so a compatibility layer is necessary, such as precompiler magic, or generating an esm edition
        -   See [typescript](https://github.com/Microsoft/TypeScript/issues/5565#issuecomment-155216760) and [babel](https://github.com/babel/babel/issues/2212) for their lack of support for `export default`

## v1.63.6 2020 June 25

-   actually set correct bin permissions for bin objects too

## v1.63.5 2020 June 25

-   set correct bin permissions for bin objects too

## v1.63.4 2020 June 25

-   prepare and use global install of `npm-check-updates` as it is much faster than going via npx
-   ensure that the bin path has executable permissions, which is required for yarn environments
-   dev change: ensure all local imports have file extension to make lookups quicker

## v1.63.3 2020 June 25

-   yarn still needs ncu to update `package.json`

## v1.63.2 2020 June 25

-   don't do `prefer-offline` as it causes inconsistent dependency versions (at least with yarn)
-   move removing old files from runtime to base, to increase performance

## v1.63.1 2020 June 25

-   remove yarn configuration files if we use npm
-   if using yarn, run `yarn upgrade`
-   run `our:setup` after all deps are sorted

## v1.63.0 2020 June 25

-   purge package manager files at start
-   better support for yarn and npm switching
-   auto default to yarn, as it is more stable
    -   this can be overwritten using boundation config
-   remove `upgradeAllDependencies`
    -   you can enforce particular dependency verisons using boundation config
-   check for dependencies that exist in both deps and devDeps, and trigger repair for this corrupted state
    -   repair will restore deps from a previous version
-   remove minami on jsdoc projects, no longer preferred
-   for yarn and npm, only uninstall installed deps to save time
    -   before this was done only for npm
-   prefer quick installs (prfer-offline, no-fund, no-audit)
-   remove support for yarn pnp, as support has changed
-   add support for preventing use of busted package versions
    -   currently required code updates, maybe one day this can be configurable

## v1.62.1 2020 June 20

-   Don't use `package.json[entry]` fields to prefill entries, as it doesn't allow auto-detection when entries change - if you wish for a fixed entry, use `package.json:boundation[whateverEntry]`

## v1.62.0 2020 June 20

-   If a file exists within the source edition of the name `node`, `deno`, or `browser` it will be selected as the entry for the appropriate edition
-   If there is only one valid node edition, then `package.json:main` will point to the node entry
-   Renamed `mainEntry` to `indexEntry` to serve more like a default in case there is conflicts
-   This allows greater support for cross-runtime packages, as custom entries can be provided for the different runtimes

## v1.61.0 2020 June 20

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.60.0 2020 June 20

-   Add support for [Dependabot v2](https://help.github.com/en/github/administering-a-repository/configuration-options-for-dependency-updates)

## v1.59.0 2020 June 20

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.58.0 2020 June 10

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.57.0 2020 June 10

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.56.0 2020 June 10

-   For compatible TypeScript npm packages, automatically attempt to generate a deno edition
-   Fixed a bug when applying numeric travis CI env vars
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.55.1 2020 May 23

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.54.3 2020 May 21

-   fixed `types` property sometimes not being included, at times it should be, inside `package.json`

## v1.54.2 2020 May 21

-   fixed json projects being compiled with babel
-   fixed travis `DELETE` requests
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.54.1 2020 May 21

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.53.4 2020 May 21

-   Fix compiled-types being generated for things other than the source directory, which causes compiled types to fail to be included
-   Fix typescript compilation always passing, due to previous lack of wrapping the tsc fix in parenthesis

## v1.53.3 2020 May 21

-   Fix balupton entries in maintainers and contributors
-   Don't output tsconfig `lib` property if it would be empty
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.53.2 2020 May 21

-   Fix the editions autoloader being used for CommonJS projects that also targetted browsers

## v1.53.1 2020 May 20

-   Fix travis email encoding on some repositories
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.53.0 2020 May 20

-   Use the Travis HTTP API instead of the buggy travis CLI
    -   To automate it:
        -   Set `TRAVIS_COM_TOKEN` to the token from https://travis-ci.com/account/preferences
        -   Set `TRAVIS_ORG_TOKEN` to the token from https://travis-ci.org/account/preferences
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.52.0 2020 May 12

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.51.0 2020 May 8

-   if typescript, compile types to `compiled:types` directory and use that
-   revert using npx, as npx always wants to install the package and this is not able to be disabled
    > If a full specifier is included, or if --package is used, npx will always use a freshly-installed, temporary version of the package. This can also be forced with the --ignore-existing flag.

## v1.50.0 2020 May 8

-   use npx for all the applicable npm script binaries

## v1.49.0 2020 May 11

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.48.0 2020 May 8

-   fix `packageModule` - was failing on [bevry/caterpillar-examples](https://github.com/bevry/caterpillar-examples)
-   browser != dom usage, so now ask about dom specifically
-   fix `desiredNodeOnly` defaulting to unexpected values
-   fix `desiredNodeOnly` being ignored if already an LTS

## v1.47.0 2020 May 6

-   add support for the bevry cdn as an alternative to cdn deployments to surge
-   travis may still have used travis-ci.org despite travis-ci.com being active, now it is explicit which to use for all calls
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.46.0 2020 May 4

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.45.0 2020 May 4

-   npx all the things for greater environment compatibility and reduction of conflicts
-   use dynamic source dir for jsdoc

## v1.44.0 2020 May 4

-   Web worker support now requires the `webworker` keyword instead of the `worker` keywords
-   Added keywords for appropriate result targets and languages
-   Added tsconfig lib entries for appropriate keywords
-   Fixed github commit fetching (for some reason `fetch-h2` was timing out, swapping to `node-fetch` resolved the problem)
-   Only add deps for the active editions, rather than also the disabled editions
-   Added missing dev deps
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.43.0 2020 April 29

-   Add support for web workers, determined by presence of the `worker` keyword
-   Add `desiredNodeOnly` question
-   If `my:deploy` exists:
    -   Use `deploy-custom` travis script
    -   Use `deploy` script to do the whole shebang

## v1.42.1 2020 April 27

-   Fix Node 14 being desired but not applied

## v1.42.0 2020 April 27

-   Update with TypeScript ES targets with the latest
-   TypeScript browser target should be what is currently implemented
-   API documentation link should not include package scope
-   Add update-contributors when scaffolded against packages
-   Latest Next.js and TypeScript conventions
-   Ensure desired Node.js version is not beyond supported Node.js version
-   Replace `githubauthquerystring` with `githubauthreq`

## v1.41.0 2020 March 26

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.40.0 2019 December 18

-   correct readme format
    -   fix missing fullstop
    -   update tutes and guides link
    -   improve web browser demonstration link
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.39.0 2019 December 18

-   correct readme format
    -   docs link will now be after the usage header
    -   typescript docs link will go to the `globals` page to show the actual documentation and not a hosted readme

## v1.38.0 2019 December 18

-   added browser entry
    -   allows `browser` and `module` fields to point to a file that doesn't have anything to do with node
-   correct readme format
    -   install will now be before history
    -   docs link will now after usage
    -   docs link text changed
-   toggle language keywords
    -   enables projects to display the correct details for `export-default`
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.37.0 2019 December 18

-   fix zero targets
-   update boundation config for latest
-   support multiple bin executables
-   fix coffeescript compile target
-   trim editions that fail rather than error
-   move travis to after runtime
-   fix website edition
-   fix edition tags being output as an object
-   don’t do babel workaround for default exports
-   fix non-automated prior answers to choices
-   fix babel after recent typescript compiler support
-   edition description improvements
-   support typescript compiler
-   question function context is now the question
-   skip subsequent editions if prior one passed all targets
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.36.0 2019 December 9

-   correctly make dependanbot only submit PRs for security yet merge all
-   do not proceed if get commit failed
-   re-add `next.config.js` creation for serverless setting
-   fixes for typescript next.js websites
-   support module outputs, add github sponsors badge
-   fixes for typescript websites
-   spawn fixes, dep updates, fix false priate trim
-   yarn detect, fix lts defaulting for website/json
-   fix npm private
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.35.0 2019 December 1

-   fix dependabot security value
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.34.0 2019 December 1

-   sort `package.json:jspm` field
-   ensure latest is not installed as exact
-   fix isES5 check
-   change dependanbot `update_type` to `security`
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.33.0 2019 December 1

-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.32.0 2019 November 18

-   fix `bin.js` being `index.js`
-   fix bin being replaced accidentally
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.31.0 2019 November 18

-   fix `--lts` causing node version to reduce if higher
-   support `package.json:boundation` configuration
-   support ES5 and source browser editions
-   fix dependabot, support ts ? chaining, fix versions compat, update deps
-   fix a type error with node major version
-   Updated dependencies, [base files](https://github.com/bevry/base), and [editions](https://editions.bevry.me) using [boundation](https://github.com/bevry/boundation)

## v1.30.0 2019 November 13

-   update node version list to the latest
-   LTS question now clearer with correct default
-   add new funding conventions, add depandabot
-   fix travis org/com selection
-   enable `--auto` for skipping all
-   fix docpad plugin being the default on new projects
-   fix lts default
-   set configuration via cli args
-   make travis non-interactive, add `GITHUB_API` support
-   output the multiple browser editions if they exist
-   better support for json only projects
-   don’t fail by making two browser editions on json
-   simpler `funding` field
-   more robust lts node version fetching
-   change dependabot to daily instead of live
-   workaround for `0.1` as `0.10` values on arg setting
-   support downgrading certain deps if needed
-   update deps

## v1.29.0 2019 September 11

-   Apply `module` field if desired if a `browser` edition exists
-   Place `module` field after `browser` field
-   Simplified LTS discovery
-   Add `ltsNodeOnly` question
-   Run prettier on source if prettier exists
-   Updated dependencies

## v1.28.2 2019 May 13

-   If react packages are peer dependencies, then install them as dev dependencies, instead of dependencies
-   Have yarn ignore engines
-   Add static directory to typescript includes
-   If the project has react, then enable react in languages
-   Add node 12 to support node versions
-   Updated dependencies

## v1.28.1 2019 March 15

-   Scaffolded files now reflect CommonJS Modules vs ES Modules.
-   No longer scaffold `tsconfig` file with `resolveJsonModule` as it caused too many issues.
-   Updated the stylelint disable reference URL for the new location
-   If there is no`test` script, then inject a noop one, to prevent tests from failing
-   No longer crashes if `.travis.yml` does not exist
-   Updated dependencies

## v1.28.0 2019 Fenruary 7

-   use latest react version, rather than next, as 16.8 is now released
-   update deps

## v1.27.0 2019 January 26

-   complete zeit stack support for now 2 and next.js 8
-   add support for yarn
-   don’t use stylelint with now, due to it being too large
-   boundation now handles stylelint support, to rather than bevry/base, such that we can add jsx support to it
-   update typescript eslint support for new packages
-   add support for mdx to next
-   improved tsconfig handling, it is now more obvious
-   update travis for latest cache rules, and to trim empty fields
-   prevent test script from being trimmed if it existed
-   ensure missing source edition doesn’t throw
-   if for some reason `exists` throws, tell us why
-   make engines is `>`= on website projects too, in order to prevent yarn from whining
-   better website project detection
-   support editions for website projects
-   use `githubauthquerystring`
-   updated deps

## v1.26.0 2019 January 14

-   Add react eslint plugins, and types, for Next.js projects
-   Use the canary version of `@zeit/next-typescript`
-   Updated TypeDoc to latest standard version, as the bugfix as been released
-   Better `types` file detection, try for `index.d.ts`, then `source/index.d.ts`, then `source/index.ts`
-   Support multiple documentation tools at once. So if there is JavaScript and TypeScript, `jsdoc` docs will go in `docs/jsdoc/` and `typedoc` docs will go inside `docs/typedoc/`

## v1.25.3 2019 January 2

-   Fixed consumption of types on TypeScript projects. The `package.json`:`types` will now point to the source edition main entry. The prior `index.d.ts` generation script from v1.23.0 was producing `File ‘index.d.ts' is not a module.ts(2306)`.
-   Ensure `our:verify:typescript` does not emit

## v1.25.2 2019 January 1

-   Fix `binEntry` being asked for even though `bin` was false
-   Fixed `joe` not being uninstalled when replaced with `kava`
-   `our:clean` now also clears the `.next` directory
-   Ensure latest `react`, `react-dom`, `next`, and `now` dependencies are being used

## v1.25.1 2018 December 27

-   Allow changing project and website types
-   Correctly generate now and next website configurations

## v1.25.0 2018 December 24

-   Streamlined the question and answer flow, surrounding project type, website type, and environment variables
    -   Questions regarding environment variables are now optional
    -   Support Now v2 deployments, and Next.js on Now types
-   Internal changes
    -   Updated version handling to support pinned versions
    -   Travis configuration will only be updated if it is desired
    -   Revised the inquirer extensions, such that:
        -   The extensions operate reliably
        -   That `when` still functions as when
        -   That dim now dims correctly
        -   That the reason for a bypass is not outputted

## v1.24.2 2018 December 22

-   If there are multiple `package.json:bin` entries, then exit with an explanation [of our lack of support](https://github.com/bevry/boundation/issues/24)

## v1.24.1 2018 December 19

-   Only do the `joe` to `kava` rename if `joe` was installed

## v1.24.0 2018 December 19

-   Remove usage of the deprecation `package.json` field `preferGlobal`
-   Fix running when there are no editions
-   Ask if we would like adaptive support for old versions, so that we can no opt out of it (say when we are writing source code that targets only our runtime node version)
-   Test node versions now default to the supports node versions

## v1.23.1 2018 December 19

-   Update typedoc

## v1.23.0 2018 December 19

-   Documentation detection is more reliable
-   Documentation will now be generated based on secondary language, instead of primary
-   TypeDoc will now ignore `node_modules` and test files
-   ESLint will now ignore `vendor` and `node_modules`
-   If the source edition used `import`, then the browser edition will too
    -   As expected, edition tags and descriptions are correctly adjusted
-   For projects where TypeScript is a secondary language:
    -   TypeDoc documentation will be generated
    -   `tsconfig.json:isolatedModules` will be disabled to allow stop `use strict` from erroring
-   For projects that are TypeScript:
    -   Adjusted `tsconfig.json:maxNodeModuleJsDepth` to support dependencies that have JSDoc comments
    -   `package.json:types` will now point to a generated declaration file, instead of the source code

## v1.22.0 2018 December 7

-   fix `joe` to `kava` rename being ineffective (feature introduced in v1.20.0)

## v1.21.0 2018 December 7

-   better support for now.sh websites

## v1.20.0 2018 December 7

-   question flow now skips questions which we already know the answer to, and ignores questions that are not applicable, while outputting their inferred result, this offers greater reliability and comprehension and speeds things up for the user
-   updated travis to support travis .com and .org, with appropriate detection of availability
-   added support for bin entries

-   tooling changes

    -   adaopted prettier
    -   move to eslint-config-bevry
        -   support the plugins it adapts to
        -   remove the old eslintrc file
    -   add babel-plugin-add-module-exports to ensure compatibility between import/require
    -   move from joe to kava, which simplifies test running, also do code renames accordingly

-   package changes

    -   fix scripts that utilise globs
    -   added documentation detection
    -   better basename detection
    -   trim empty objects in package.json writes
    -   add sorting for new keys
    -   support preferGlobal if bin entry was provided
    -   remove the installation of self altogether, rather than just for specific instances
    -   remove dependencies before adding dependencies
        -   fixes adding babel, then removing the old babel, which makes the babel cli unavailable
    -   fix scripts that utilise globs

-   editions changes
    -   support for `.` source directory
    -   better desription support for node and browser targets
    -   better non-edition support for entry, browser, test, and bin
    -   edition detection is now more accurate, reliable, and less complicated
        -   fixes case where say edition-0.12 runs only for node 0.12, before its engines would be set to >=0.12, when now its engines are just what it supports
        -   also fixes issue where editions that support older versions, but not their target, were getting trimmed, despite their need

## v1.19.0 2018 November 16

-   Added support for editions v2.1
-   Added support for TypeScript, with babel and eslint integration, and types field set for consumption
-   Added edition testing for node v11
-   Added support for custom babel configuration in `package.json`
-   More effecient edition support
-   Automatic babel detection and removal if not needed
-   Safer autoloader cleanup of `index.js` and `test.js` if they were not autoloader files
-   Updated dependencies, base files, and readme

## v1.18.4 2018 November 16

-   Fix crash when git remote is empty
-   Fixed nowName being an object for a new now project
-   Update badges for bevry
-   Set nowToken and NowTeam for travis if desired
-   Fixed stylelint install (for websites) and removals for non-websites
-   Allow boundation to work without editions, which is the case for websites

## v1.18.3 2018 October 27

-   Fixed website types failing with `You must provide a "choices" parameter`

## v1.18.2 2018 October 1

-   always output boundation location, version, and project location
-   fix custom sections in ignore files not being kept
-   update for latest docpad plugin conventions
-   trims `.babelrc` file, as we do it via `package.json`
-   help ensure contributors and badge defaults exist
-   prefer git details over package details, as package could be a template
-   ensure editions work on windows, and support unique compiled editions without autoloader
-   fix npm uninstalls not working
-   only write editions test loader if a test file exists
-   remove `our:setup:docpad` as it is no longer unneeded
-   move `upgradeAllDependencies` questions to a better order position
-   update dependencies

## v1.18.1 2018 August 19

-   Fixed edition descriptions like `coffeescript compiled for node.js true with require for modules`
    -   will now be `coffeescript compiled for node.js with require for modules`
-   Fixed `TypeError: chalk.bold.underline.orange is not a function`

## v1.18.0 2018 August 19

Edition engines are now the range of unique supported versions for that edition, and are trimmed and passed accordingly.

For instance, say `edition:esnext` supports node 6, 8, 10 and `edition:node:0.8` only node 0.10, 0.12, 4.
You wouldn't want `edition:node:0.8` to run against node 6, 8, 10 via an engine of `>0.10`.
As such, targeted editions now have their engines set to the specific node versions they support.
So for this example, `edition:node:0.8` would have the engines `0.10 || 0.12 || 4` instead of `>0.10`.

This can be seen from the following log output:

```text
determining engines for edition [edition:esnext]...
passed: 6.14.3, 8.11.3, 10.8.0
unique: 6.14.3, 8.11.3, 10.8.0
supported: 6.14.3, 8.11.3, 10.8.0
failed: 0.10.48, 0.12.18, 4.9.1
unique: 0.10.48, 0.12.18, 4.9.1
required:
...determined engines for edition [edition:esnext] as [>=6] against [0.10.48, 0.12.18, 4.9.1, 6.14.3, 8.11.3, 10.8.0]
determining engines for edition [edition:node:10]...
passed: 0.10.48, 0.12.18, 4.9.1
unique: 0.10.48, 0.12.18, 4.9.1
supported:
failed: 6.14.3, 8.11.3, 10.8.0
unique:
required:
The edition [edition:node:10] had no unique node versions that it supported, so will been trimmed
determining engines for edition [edition:node:8]...
passed: 0.10.48, 0.12.18, 4.9.1
unique: 0.10.48, 0.12.18, 4.9.1
supported:
failed: 6.14.3, 8.11.3, 10.8.0
unique:
required:
The edition [edition:node:8] had no unique node versions that it supported, so will been trimmed
determining engines for edition [edition:node:0.10]...
passed: 0.10.48, 0.12.18, 4.9.1
unique: 0.10.48, 0.12.18, 4.9.1
supported: 0.10.48, 0.12.18, 4.9.1
failed: 6.14.3, 8.11.3, 10.8.0
unique:
required:
...determined engines for edition [edition:node:0.10] as [0.10 || 0.12 || 4] against [0.10.48, 0.12.18, 4.9.1, 6.14.3, 8.11.3, 10.8.0]
removing useless editions edition:node:10, edition:node:8...
...removed useless editions
```

## v1.17.5 2018 August 19

-   All dependencies will now only be updated if you specify so
-   Fixed coffeescript compilations

## v1.17.4 2018 August 17

-   Fixed only one edition being added to babel env, instead of all applicable ones

## v1.17.3 2018 August 17

-   Fixed `documentation` dependency not being added under circumstances when it was needed

## v1.17.2 2018 August 17

-   Don't write `babel` property if it is empty
-   Relocate root source files to their new locations rather than deleting them
-   Correctly set extension in browser field

## v1.17.1 2018 August 17

-   Ran boundation on boundation

## v1.17.0 2018 August 17

-   Ensure `version` property exists
-   Support for multiple languages
-   Support for now.sh deployments
-   Updated for version 2 of the editions autoloader, enabling the following changes:
    -   Editions are now replaced with autogenerated ones, to ensure the latest conventions are applied
    -   Editions are now generated to target specific node and browser environments
    -   Editions now have their engines.node property set to the node versions that edition supports
    -   Editions are trimmed if their engines already supported by an earlier edition
    -   Package engine is now determined automatically based on the minimum node version which passed the tests against any edition
-   Dozens of minor fixes, improvements, and additions

## v1.16.2 2018 June 13

-   Removed npm email, username, password support
-   Fixed type and default for npm auth token
-   Maximum support node version now defaults to the latest known node version

## v1.16.1 2018 June 6

-   Add `--version` flag

## v1.16.0 2018 June 6

-   Swap node 9 to node 10 now that node 10 is out and node 9 is deprecated
-   Change node engine to >=10 instead of >=9
-   Updated dependencies

## v1.15.0 2018 February 15

-   Added support for `website` and `coded-website` project types
    -   Closes [#6](https://github.com/bevry/boundation/issues/6)
-   Awesome Travis scripts are changed flags from `-s` to `fsSL`
-   Fixed editions being replaced on existing JavaScript projects

## v1.14.2 2018 February 15

-   Repackaged

## v1.14.1 2018 February 15

-   Repackaged

## v1.14.0 2018 February 15

-   Renamed from `bevry-base` to `boundation`

## v1.13.0 2018 February 15

-   You can now scaffold new projects by running inside an empty directory
    -   Closes [#1](https://github.com/bevry/based/issues/1)
-   Now uses `npm` and `npm-check-updates` instead of `yarn`

## v1.12.0 2018 February 15

-   Remove Gratipay badge as it no longer exists

## v1.11.0 2018 February 7

-   DocPad Plugins are now better supported, no longer need the placeholder files introduced in v1.10.0
-   Now asks about the author information and will try and fetch it from git
-   Now asks about the test entry location
    -   Closes [#2](https://github.com/bevry/based/issues/2)

## v1.10.0 2018 February 7

-   The CoffeeScript v2 upgrade (from v1.9.0) now works with DocPad CoffeeScript projects

## v1.9.0 2018 January 26

-   Support CoffeeScript v2
-   Support Biscotto for CoffeeScript documentation
-   Support Editions without any directory
-   Support JSON project type
-   Use `GITHUB_CLIENT_SECRET` and `GITHUB_CLIENT_ID` to fetch latest commit if available to prevent hitting github's rate limits

## v1.8.0 2018 January 24

-   Install surge dev dep if needed

## v1.7.1 2018 January 24

-   Fixed the previous release

## v1.7.0 2018 January 24

-   Fetch supported and LTS node versions dynamically
-   Updated base files

## v1.6.0 2018 January 24

-   Keep and merge package scripts that are prefixed with `my:`
    -   Closes [issue #7](https://github.com/bevry/based/issues/7)
-   Unset surge env vars on travis if not needed
-   Updated base files

## v1.5.2 2018 January 24

-   Ask for the desired node version instead of guessing it
-   Updated base files

## v1.5.1 2018 January 24

-   Updated base files

## v1.5.0 2018 January 24

-   Use awesome-travis commit instead of master
    -   Closes [issue #3](https://github.com/bevry/based/issues/3)
-   Fix `coffee-script` dep (when needed) always being moved to devDeps
    -   Closes [issue #11](https://github.com/bevry/based/issues/11)
-   Delete legacy `directories` field
    -   Closes [issue #9](https://github.com/bevry/based/issues/9)
-   Don't fail when using a SSH git remote
-   Support Auth Tokens for NPM instead of the Email, Username, and Password combination
-   Updated supported node versions for travis
-   Output travis environment variables
-   Updated base files

## v1.4.4 2017 May 12

-   Convert edition v1.0 standard to edition v1.1+
    -   Closes [issue #12](https://github.com/bevry/based/issues/12)

## v1.4.3 2017 April 16

-   Delete old `nakeConfiguration` property
    -   Closes [issue #8](https://github.com/bevry/based/issues/8)

## v1.4.2 2017 April 16

-   Fixed busted `docs` npm script due to typo

## v1.4.1 2017 April 10

-   Installing yuidoc now works

## v1.4.0 2017 April 1

-   Update history file standard
    -   Closes [issue #4](https://github.com/bevry/based/issues/4)
-   Fixed `mkdir: source: File exists` regression from v1.3.0

## v1.3.1 2017 April 1

-   Fixed some misplaced code

## v1.3.0 2017 April 1

-   No longer fails right away when scaffolding empty directories
-   Still fails in the above case as the test file does not yet exist, will address in a future release

## v1.2.2 2017 March 31

-   Before we run the tests, run `our:setup` first

## v1.2.1 2017 March 31

-   Perform a `yarn upgrade` after the `yarn`

## v1.2.0 2017 March 31

-   Put travis customisation behind a flag

## v1.1.3 2017 March 31

-   Don't install testing deps if DocPad provides them

## v1.1.2 2017 March 31

-   Fixed travis yaml writing risking curruption

## v1.1.1 2017 March 31

-   Fixed travis env vars risking undoing the progress of others
-   Fixed `test.js` and `index.js` still being downloaded under circumstances when they shouldn't
-   Update the DocPad dev dependency if it exists
-   More extensive package.json object sorting

## v1.1.0 2017 March 31

-   CoffeeScript projects now properly supported
-   DocPad plugins now properly supported
-   Old dependencies are now removed
-   Old files are now renamed or removed

## v1.0.0 2017 March 31

-   Initial working release
