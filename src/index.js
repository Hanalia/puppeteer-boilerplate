const fs = require('fs')
const path = require('path')
const puppeteer = require("puppeteer");



const getconfig = () => {
  const readFileLines = filename =>
    fs.readFileSync(filename)
      .toString('UTF8')
      .split('\n')
      .map(item => item.replace(/\s+/g, ' ').trim());

  const isPkg = typeof process.pkg !== 'undefined'
  const folderPath = (isPkg) ? process.cwd() : __dirname;
  const filePath = path.join(folderPath, '환경설정.txt')
  try {
    const arr = readFileLines(filePath)
      .map(item => [item.split("=")[0], item.split("=")[1]])
      .filter(item => !!item[0]);
    console.log(arr)
    const obj = Object.fromEntries(arr)
    return obj

  }
  catch (e) {
    console.log("환경설정 파일을 찾을 수 없습니다.")
  }
}

async function convertToCSV(arr, filename) {
  const array = [Object.keys(arr[0])].concat(arr)

  const convertedArray = array.map(row => {
    return Object.values(row).map(value => {
      return typeof value === 'string' ? JSON.stringify(value.replaceAll('"', "'")) : value
    }).toString()
  }).join('\n')

  fs.writeFile(`${filename}.csv`, convertedArray, "utf8", () => {
  });
}


const reviewsLimit = 100; // hardcoded limit for demonstration purpose

const searchParams = {
  id: "com.discord", // Parameter defines the ID of a product you want to get the results for
  hl: "en", // Parameter defines the language to use for the Google search
  gl: "us", // parameter defines the country to use for the Google search
};

const URL = `https://play.google.com/store/apps/details?id=${searchParams.id}&hl=${searchParams.hl}&gl=${searchParams.gl}`;

async function scrollPage(page, clickElement, scrollContainer) {
  let lastHeight = await page.evaluate(`document.querySelector("${scrollContainer}").scrollHeight`);
  while (true) {
    await page.click(clickElement);
    await page.waitForTimeout(500);
    await page.keyboard.press("End");
    await page.waitForTimeout(2000);
    let newHeight = await page.evaluate(`document.querySelector("${scrollContainer}").scrollHeight`);
    const reviews = await page.$$(".RHo1pe");
    if (newHeight === lastHeight || reviews.length > reviewsLimit) {
      break;
    }
    lastHeight = newHeight;
  }
}

async function getReviewsFromPage(page) {
  return await page.evaluate(() => ({
    reviews: Array.from(document.querySelectorAll(".RHo1pe")).map((el) => ({
      title: el.querySelector(".X5PpBb")?.textContent.trim(),
      avatar: el.querySelector(".gSGphe > img")?.getAttribute("srcset")?.slice(0, -3),
      rating: parseInt(el.querySelector(".Jx4nYe > div")?.getAttribute("aria-label")?.slice(6)),
      snippet: el.querySelector(".h3YV2d")?.textContent.trim(),
      likes: parseInt(el.querySelector(".AJTPZc")?.textContent.trim()) || "No likes",
      date: el.querySelector(".bp9Aid")?.textContent.trim(),
    })),
  }));
}


async function getAppReviews() {

  const configs = getconfig()
  console.log(configs.chrome_path)
  const chromeLocalPath = configs.chrome_path || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  console.log({ chromeLocalPath })

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: chromeLocalPath,
  });
  const page = await browser.newPage();

  await page.setDefaultNavigationTimeout(60000);
  console.log(URL)
  await page.goto(URL);

  await page.waitForSelector(".qZmL0");

  const moreReviewButton = await page.$("c-wiz[jsrenderer='C7s1K'] .VMq4uf button");

  if (moreReviewButton) {
    await page.click("c-wiz[jsrenderer='C7s1K'] .VMq4uf button");
    await page.waitForSelector(".RHo1pe .h3YV2d");
    await scrollPage(page, ".RHo1pe .h3YV2d", ".odk6He");
  }
  const reviews = await getReviewsFromPage(page);

  await browser.close();

  return reviews;
}

getAppReviews().then((result) => convertToCSV(result.reviews, "result"));
