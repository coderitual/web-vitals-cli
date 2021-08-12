const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');
const argv = require('yargs').argv;
const chromeLauncher = require('chrome-launcher');
const reportGenerator = require('lighthouse/report/report-generator');
const request = require('request');
const util = require('util');
const fs = require('fs');
const convertUrlToFilename = require('./convertUrlToFilename');

const url = argv.url ?? 'https://brainly.com/question/1713545';

const devices = puppeteer.devices;
const nexus5 = devices['Nexus 5'];

const blockedUrlPatterns = [
  '*datadome*',
  '*doubleclick*',
  '*hotjar*',
  '*datadome*',
  '*survicate*',
  '*facebook*',
  '*quantcount*',
  '*branch.io*',
  '*connatix*',
  '*aaxads*',
  '*sentry*',
  '*aaxdetect*',
  '*app.link*',
  '*google*',
];

const options = {
  output: 'html',
  onlyCategories: ['performance'],
  disableDeviceEmulation: true,
  chromeFlags: ['--disable-mobile-emulation'],
};

const config = {
  extends: 'lighthouse:default',
  settings: {
    maxWaitForFcp: 15 * 1000,
    maxWaitForLoad: 35 * 1000,
    // lighthouse:default is mobile by default
    // Skip the h2 audit so it doesn't lie to us. See https://github.com/GoogleChrome/lighthouse/issues/6539
    skipAudits: ['uses-http2'],
  },
  audits: ['metrics/first-contentful-paint-3g'],
  categories: {
    // TODO(bckenny): type extended Config where e.g. category.title isn't required
    performance: /** @type {LH.Config.CategoryJson} */ ({
      auditRefs: [{ id: 'first-contentful-paint-3g', weight: 0 }],
    }),
  },
};

async function lighthouseFromPuppeteer(url, options, config = null) {
  // Launch chrome using chrome-launcher
  const chrome = await chromeLauncher.launch(options);
  options.port = chrome.port;

  // Connect chrome-launcher to puppeteer
  const resp = await util.promisify(request)(
    `http://localhost:${options.port}/json/version`,
  );
  const { webSocketDebuggerUrl } = JSON.parse(resp.body);
  const browser = await puppeteer.connect({
    browserWSEndpoint: webSocketDebuggerUrl,
  });

  // Run Lighthouse
  const { lhr, report } = await lighthouse(url, options, config);

  const json = reportGenerator.generateReport(lhr, 'json');

  const audits = JSON.parse(json).audits; // Lighthouse audits

  const first_contentful_paint = audits['first-contentful-paint'].displayValue;
  const largest_contentful_paint =
    audits['largest-contentful-paint'].displayValue;
  const speed_index = audits['speed-index'].displayValue;
  const max_potential_fid = audits['max-potential-fid'].displayValue;
  const cumulative_layout_shift =
    audits['cumulative-layout-shift'].displayValue;
  const total_blocking_time = audits['total-blocking-time'].displayValue;
  const time_to_interactive = audits['interactive'].displayValue;

  console.log(`\n
     Lighthouse metrics: 
     URL: ${url},
     🎨 First Contentful Paint: ${first_contentful_paint}, 
     📱 Cumulative Layout Shift: ${cumulative_layout_shift},
     🌄 Largest Contentful Paint: ${largest_contentful_paint},
     ⏳ Max Potential FID: ${max_potential_fid},
     ⌛️ Total Blocking Time: ${total_blocking_time},
     👆 Time To Interactive: ${time_to_interactive}`);

  return {
    first_contentful_paint,
    cumulative_layout_shift,
    largest_contentful_paint,
    max_potential_fid,
    total_blocking_time,
    time_to_interactive,
  };

  await browser.disconnect();
  await chrome.kill();
}

async function gatherResults(url, options, config) {
  const results = [];
  for (const blockedUrl of blockedUrlPatterns) {
    for (let i = 0; i < 1; i++) {
      const result = await lighthouseFromPuppeteer(url, options, config);
      results.push({
        url,
      });
    }
  }
  return results;
}

function saveToCSV(url, results) {
  fs.appendFileSync(
    `${convertUrlToFilename(url)}.csv`,
    `url, first_contentful_paint, cumulative_layout_shift, largest_contentful_paint, max_potential_fid, total_blocking_time, time_to_interactive`,
    function (err) {
      if (err) throw err;
    },
  );

  results.forEach(
    ({
      url,
      first_contentful_paint,
      cumulative_layout_shift,
      largest_contentful_paint,
      max_potential_fid,
      total_blocking_time,
      time_to_interactive,
    }) => {
      fs.appendFileSync(
        `${convertUrlToFilename(url)}.csv`,
        `url, first_contentful_paint, cumulative_layout_shift, largest_contentful_paint, max_potential_fid, total_blocking_time, time_to_interactive`,
        function (err) {
          if (err) throw err;
        },
      );
    },
  );
}

const results = gatherResults(url, options, config);
saveToCSV(url, results);
