# language-parser

In order for this script to work the package.json must containt "type": "module" at top level
If using node <= 13, experimental features have to be enabled. For node > 14 experimental features
are enabled by default

Installation (NPM): npm i --save-dev language-parser

Installation (Yarn): yarn add --dev language-parser

Usage: node ./node_modules/language-parser/parser.js -a [merge | split | fill] -l [languages] -f [jsonFile] -d [languageWithKeys]

Ex:

- `npx language-parser -a merge -l en-en,nl-nl`
- `npx language-parser -a split -f locales.json`
- `npx language-parser -a fill -l nl-nl -d en-en`
- `npx language-parser -a toJson -i locales.csv -o locales.json`
- `npx language-parser -a toCsv -i locales.json -o locales.csv`
