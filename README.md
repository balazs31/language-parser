# language-parser

 In order for this script to work the package.json must containt "type": "module" at top level
 If using node <= 13, experimental features have to be enabled. For node > 14 experimental features
 are enabled by default

Installation (NPM): npm i --save-dev language-parser

Installation (Yarn): yarn add --dev language-parser

 Usage: node ./node_modules/language-parser/parser.js -a [merge | split | fill] -l [languages] -f [jsonFile] -d [languageWithKeys]
 
 Ex: 
 * `node ./node_modules/language-parser/parser.js -a merge -l en-en,nl-nl`
 * `node ./node_modules/language-parser/parser.js -a split -f locales.json`
 * `node ./node_modules/language-parser/parser.js -a fill -l nl-nl,nl-de -d en-en`
