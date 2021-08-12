const argv = require('yargs').argv;
const convertUrlToFilename = require('./lib/convertUrlToFilename');
const lighthouseFromPuppeteer = require('./lib/lighthouseFromPuppeteer');
const saveToCsv = require('./lib/saveToCsv');
const getBlockedUrlPatterns = require('./getBlockedUrlPatterns');
const getConfig = require('./getConfig');
const getOptions = require('./getOptions');

// CLI arguments
const numberOfRuns = argv.numberOfRuns ?? 5;
const url = argv.url ?? 'https://brainly.com/question/1713545';
const filename =
  argv.filename ??
  `results/isolated_n${numberOfRuns}_${convertUrlToFilename(
    url,
  )}-${Date.now()}.csv`;

const blockedUrlPatterns = getBlockedUrlPatterns();
const config = getConfig();
const options = getOptions();

async function gatherResults(url, options, config, blockedUrlPatterns) {
  const results = [];
  const patterns = ['', ...blockedUrlPatterns];
  const runs = patterns.length * numberOfRuns;
  let run = 0;
  for (const pattern of patterns) {
    for (let i = 0; i < numberOfRuns; i++) {
      run++;
      console.log(`\n🏃‍♂️ Run isolated: ${run} / ${runs}`);
      const opts = {
        ...options,
        blockedUrlPatterns: [pattern].filter(Boolean),
      };
      const result = await lighthouseFromPuppeteer(url, opts, config);
      results.push({
        url,
        pattern,
        ...result,
      });
    }
  }
  return results;
}

async function main() {
  const results = await gatherResults(url, options, config, blockedUrlPatterns);
  saveToCsv(filename, url, results);
  process.exit(0);
}

main();
