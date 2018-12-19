# History

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
