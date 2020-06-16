/**
 * In order for this script to work the package.json must containt "type": "module" at top level
 * If using node <= 13, experimental features have to be enabled. For node > 14 experimental features
 * are enabled by default
 *
 * Installation (NPM): npm i --save-dev language-parser
 * Installation (Yarn): yarn add --dev language-parser

 * Usage: node ./node_modules/language-parser/parser.js -a [merge | split] -l [languages] -f [jsonFile]
 * Ex: node ./node_modules/language-parser/parser.js -a merge -l en-en,nl-nl
 *     node ./node_modules/language-parser/parser.js -a split -f locales.json
 */

import fs from "fs";
import path from "path";
import prettier from "prettier";
import minimist from "minimist";

const args = minimist(process.argv.slice(2));

/**
 * The template of the exported language file
 */
const lngFileTemplate = "const LNG = DATA; \n\n export { LNG }";

const lngObj = {};

/**
 * Checks if the found language file was given by runtime argument
 */
const isLanguageSupported = (file, languages = []) => {
  const [_, language] = file.split(".").reverse();
  return languages.includes(language);
};

/**
 * Checks if the file is a language file
 */
const isLanguageFile = (file, languages = []) => {
  return file.includes("lang") && isLanguageSupported(file, languages);
};

/**
 * Returns the language of a valid language file (ex: en-en);
 */
const getFileLanguage = (file) => {
  const [_, language] = file.split(".").reverse();
  return language;
};

/**
 * Formats the language key to it's js variable name, ex: en-en => en_en
 *  */
const formatLanguageToJs = (lng) => {
  const formattedLng = lng.replace("-", "_");
  return formattedLng;
};

/**
 * Imports the language variable from a JS file
 */
const getLanguageVariable = async (file, lng) => {
  const formattedLng = formatLanguageToJs(lng);
  const module = await import(file);
  return module[formattedLng];
};

/**
 * Iterates thorugh every file, to merge the language files into a single json
 */
const walk = function (dir, languages = [], done) {
  let results = [];
  fs.readdir(dir, function (err, list) {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, async function (err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, languages, function (err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          if (isLanguageFile(file, languages)) {
            const fileLng = getFileLanguage(file);
            const relativePath = path.relative(process.cwd(), file);
            const data = await getLanguageVariable(file, fileLng);
            lngObj[fileLng][relativePath] = data;
            results.push(file);
          }

          next();
        }
      });
    })();
  });
};

/**
 * Writes the content to a file
 */
const writeFile = (path, content) => {
  fs.writeFileSync(path, content);
};

/**
 * Exports the merges languages into the locales.json file
 */
const exportJson = (obj) => {
  const stringifiedObj = JSON.stringify(obj);
  writeFile("locales.json", stringifiedObj);
};

/**
 * Returns the languages from a locales.json file
 */
const getLanguages = (obj) => {
  return Object.keys(obj).map((key) => {
    return key;
  });
};

/**
 * Creates and formats the language file
 */
const writeLanguageToFile = (file, lng, data) => {
  let parsedTemplate = lngFileTemplate.replace(/LNG/g, formatLanguageToJs(lng));
  parsedTemplate = parsedTemplate.replace(/DATA/g, JSON.stringify(data));
  parsedTemplate = prettier.format(parsedTemplate, { parser: "babel" });
  writeFile(file, parsedTemplate);
};

/**
 * Writes every json entry to a language file
 */
const writeLanguage = (lng, jsonData) => {
  const lngObj = jsonData[lng];

  Object.keys(lngObj).forEach((path) => {
    writeLanguageToFile(path, lng, lngObj[path]);
  });
};

/**
 * Merges the language files into a single .json file
 */
const mergeLanguageFiles = () => {
  const languages = [...args.l.split(",")];

  languages.forEach((lng) => {
    lngObj[lng] = {};
  });

  walk("./src/components", languages, function (err, results) {
    if (err) throw err;
    exportJson(lngObj);
  });
};

/**
 * Splits the languages files from a .json file
 */
const splitLanguageFiles = async () => {
  const file = args.f;
  let jsonData = JSON.parse(fs.readFileSync(file, "utf-8"));
  const languages = getLanguages(jsonData);
  languages.forEach((lng) => {
    writeLanguage(lng, jsonData);
  });
};

/**
 * Starts the script
 */
const init = () => {
  const action = args.a;

  switch (action) {
    case "merge":
      mergeLanguageFiles();
      break;
    case "split":
      splitLanguageFiles();
      break;
    default:
      console.error("Invalid action. Use one of the following: merge, split");
  }
};

init();