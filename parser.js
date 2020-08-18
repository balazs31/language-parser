#!/usr/bin/env node

/**
 * In order for this script to work the package.json must containt "type": "module" at top level
 * If using node <= 13, experimental features have to be enabled. For node > 14 experimental features
 * are enabled by default
 *
 * Installation (NPM): npm i --save-dev language-parser
 * Installation (Yarn): yarn add --dev language-parser

 * Usage: node ./node_modules/language-parser/parser.js -a [merge | split | fill | toJson | toCsv] -l [languages] -f [jsonFile] -d [defaultLangue] -i [inputFile] -o [outputFile]
 * Ex: npx language-parser -a merge -l en-en,nl-nl
 *     npx language-parser -a split -f locales.json
 *     npx language-parser -a fill -l nl-nl -d en-en
 *     npx language-parser -a toJson -i locales.csv -o locales.json
 *     npx language-parser -a toCsv -i locales.json -o locales.csv
 */

import fs, { write } from "fs";
import path from "path";
import prettier from "prettier";
import minimist from "minimist";
import lineReader from "line-reader";
import lodash from "lodash";
const { merge } = lodash;

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
 * Returns the name of the component
 */
const getFileName = (path) => {
  const [file] = path.split("/").reverse();
  const [name] = file.split(".");

  return name;
};

/**
 * Returns the language file anme without the language suffix
 */
const getLanguageFileNameWithoutSuffix = (path) => {
  const name = path.split(".").slice(0, 2).join(".");
  return name;
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
  const obj = module[formattedLng];
  const fileName = getFileName(file);
  delete obj[fileName];

  return obj;
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
      if (dir.includes("node_modules")) {
        return done(null, results);
      }

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

const getObjectKeysWithEmptyValues = (obj) => {
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === "object") {
      iterate(obj[key]);
    } else {
      obj[key] = "";
    }
  });

  return obj;
};

/**
 *
 */
const fillFiles = function (dir, languages = [], defaultLanguge, done) {
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
          fillFiles(file, languages, defaultLanguge, function (err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          if (isLanguageFile(file, [defaultLanguge])) {
            const fileLng = getFileLanguage(file);
            if (fileLng === defaultLanguge) {
              const data = await getLanguageVariable(file, fileLng);
              const objWithEmptyValues = getObjectKeysWithEmptyValues(data);
              languages.forEach((lng) => {
                let splittedFile = file.split(".");
                splittedFile[splittedFile.length - 2] = lng;
                const lngFile = splittedFile.join(".");
                writeLanguageToFile(lngFile, lng, objWithEmptyValues);
              });
            }
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
const exportJson = (obj, name = "locales.json") => {
  let stringifiedObj = JSON.stringify(obj, null, 2);
  writeFile(name, stringifiedObj);
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

const mergeObjectKeys = (languages, jsonData) => {
  const lngObj = jsonData[languages[0]];
  const newObj = {};
  Object.keys(lngObj).map((fileKey) => {
    const fileName = getLanguageFileNameWithoutSuffix(fileKey);
    newObj[fileName] = {};
    languages.forEach((lng) => {
      const currentLngFileName = `${fileName}.${lng}.js`;
      const currentLngObj = jsonData[lng][currentLngFileName];
      newObj[fileName] = merge(newObj[fileName], currentLngObj);
    });
  });

  return newObj;
};

/**
 * Creates the Csv object
 */
const createCsvData = (jsonData) => {
  const languages = getLanguages(jsonData);

  let csvContent = "File,Key," + languages.map((lng) => `${lng}`) + "\n";

  const mergedLanguageObjects = mergeObjectKeys(languages, jsonData);

  Object.keys(mergedLanguageObjects).map((fileName) => {
    return Object.keys(mergedLanguageObjects[fileName]).map((valueKey) => {
      const row =
        `${fileName},${valueKey},` +
        languages.map((lng) => {
          const currentLngFileName = `${fileName}.${lng}.js`;
          const currentLngObj = jsonData[lng][currentLngFileName];
          return currentLngObj[valueKey] || "";
        });
      csvContent += row + "\n";
    });
  });

  return csvContent;
};

/**
 * Creates a Json object from csv data
 */
const createJsonFromCsv = (input) => {
  let currentLocale = null;
  const json = {};
  let index = 0;
  let languages = [];
  return new Promise((resolve, reject) => {
    lineReader.eachLine(input, (line, last) => {
      if (index === 0) {
        languages = line.split(",").slice(2);
        languages.forEach((lng) => {
          json[lng] = {};
        });
      } else {
        const [file, key] = line.split(",");
        const values = line.split(",").slice(2);

        languages.forEach((lng, index) => {
          const fileName = `${file}.${lng}.js`;
          if (!json[lng][fileName]) {
            json[lng][fileName] = {};
          }
          if (values[index]) {
            json[lng][fileName][key] = values[index];
          }
        });
      }

      index++;

      if (last) {
        resolve(json);
      }
    });
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

  const directories = ["./src", "./native/hooks", "./native/components"];

  directories.forEach((dir) => {
    walk(dir, languages, function (err, results) {
      if (err) throw err;
      exportJson(lngObj);
    });
  });
};

/**
 * Splits the languages files from a .json file
 */
const splitLanguageFiles = async () => {
  const file = args.f || "locales.json";
  let jsonData = JSON.parse(fs.readFileSync(file, "utf-8"));
  const languages = getLanguages(jsonData);
  languages.forEach((lng) => {
    writeLanguage(lng, jsonData);
  });
};

/**
 * Fills empty language files, with the exiting keys from the default language file
 */
const fillLanguageFiles = () => {
  const defaultLng = args.d;
  const languages = [...args.l.split(",")];

  fillFiles("./", languages, defaultLng, function (err, results) {
    if (err) throw err;
  });
};

/**
 * Converts a locale json to csv
 */
const convertJsonToCsv = () => {
  const input = args.i || "locales.json";
  const output = args.o || "locales.csv";

  const jsonData = JSON.parse(fs.readFileSync(input, "utf-8"));
  const csv = createCsvData(jsonData);
  writeFile(output, csv);
};

/**
 * Converts a csv file to json
 */
const convertCsvToJson = async () => {
  const input = args.i || "locales.csv";
  const output = args.o || "locales.json";

  const json = await createJsonFromCsv(input);
  exportJson(json, output);
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
    case "fill":
      fillLanguageFiles();
      break;
    case "toCsv":
      convertJsonToCsv();
      break;
    case "toJson":
      convertCsvToJson();
      break;
    default:
      console.error("Invalid action. Use one of the following: merge, split");
  }
};

init();
