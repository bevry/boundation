# History

## v1.6.0 2018 January 24
- Keep and merge package scripts that are prefixed with `my:`
    - Closes [issue #7](https://github.com/bevry/based/issues/7)
- Unset surge env vars on travis if not needed
- Updated base files

## v1.5.2 2018 January 24
- Ask for the desired node version instead of guessing it
- Updated base files

## v1.5.1 2018 January 24
- Updated base files

## v1.5.0 2018 January 24
- Use awesome-travis commit instead of master
    - Closes [issue #3](https://github.com/bevry/based/issues/3)
- Fix `coffee-script` dep (when needed) always being moved to devDeps
    - Closes [issue #11](https://github.com/bevry/based/issues/11)
- Delete legacy `directories` field
    - Closes [issue #9](https://github.com/bevry/based/issues/9)
- Don't fail when using a SSH git remote
- Support Auth Tokens for NPM instead of the Email, Username, and Password combination
- Updated supported node versions for travis
- Output travis environment variables
- Updated base files

## v1.4.4 2017 May 12
- Convert edition v1.0 standard to edition v1.1+
    - Closes [issue #12](https://github.com/bevry/based/issues/12)

## v1.4.3 2017 April 16
- Delete old `nakeConfiguration` property
    - Closes [issue #8](https://github.com/bevry/based/issues/8)

## v1.4.2 2017 April 16
- Fixed busted `docs` npm script due to typo

## v1.4.1 2017 April 10
- Installing yuidoc now works

## v1.4.0 2017 April 1
- Update history file standard
    - Closes [issue #4](https://github.com/bevry/based/issues/4)
- Fixed `mkdir: source: File exists` regression from v1.3.0

## v1.3.1 2017 April 1
- Fixed some misplaced code

## v1.3.0 2017 April 1
- No longer fails right away when scaffolding empty directories
- Still fails in the above case as the test file does not yet exist, will address in a future release

## v1.2.2 2017 March 31
- Before we run the tests, run `our:setup` first

## v1.2.1 2017 March 31
- Perform a `yarn upgrade` after the `yarn`

## v1.2.0 2017 March 31
- Put travis customisation behind a flag

## v1.1.3 2017 March 31
- Don't install testing deps if DocPad provides them

## v1.1.2 2017 March 31
- Fixed travis yaml writing risking curruption

## v1.1.1 2017 March 31
- Fixed travis env vars risking undoing the progress of others
- Fixed `test.js` and `index.js` still being downloaded under circumstances when they shouldn't
- Update the DocPad dev dependency if it exists
- More extensive package.json object sorting

## v1.1.0 2017 March 31
- CoffeeScript projects now properly supported
- DocPad plugins now properly supported
- Old dependencies are now removed
- Old files are now renamed or removed

## v1.0.0 2017 March 31
- Initial working release
