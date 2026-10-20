const { chromium } = require('playwright');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'user_browser_data');
const HOME_URL = "https://hh.ru";

async function humanTypeString(page, textString) {
    for (const character of textString) {
        await page.keyboard.type(character);
        await page.waitForTimeout(Math.random() * (220 - 70) + 70);
    }
}

async function humanSmoothScroll(page) {
    let currentPosition = 0;
    while (true) {
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        const totalHeight = await page.evaluate(() => document.body.scrollHeight);
        const scrollStep = Math.floor(Math.random() * (350 - 180) + 180); 
        await page.evaluate((step) => window.scrollBy(0, step), scrollStep);
        currentPosition += scrollStep;
        await page.waitForTimeout(Math.random() * (120 - 40) + 40); 
        if (currentPosition + viewportHeight >= totalHeight) break;
    }
}

async function executeOnDemandScrape(searchQuery, socket) {
    console.log(`Launching Real-Time Streaming Search Automation for: "${searchQuery}"`);
    
    const allScrapedVacancies = [];
    
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        viewport: { width: 1366, height: 768 },
        locale: "ru-RU"
    });

    const page = await context.newPage();
    let pageIndex = 1;
    let hasNextPage = true;
    let globalCounterUid = 1;

    try {
        await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(4000);

        const inputElement = page.locator('input#a11y-search-input').first();
        if ((await inputElement.count()) === 0) throw new Error("Search field missing on homepage.");

        await inputElement.click();
        await page.waitForTimeout(500);
        
        await humanTypeString(page, searchQuery);
        await page.waitForTimeout(1000);

        const submitButton = page.locator('button', { hasText: 'Найти' }).first();
        await submitButton.click();
        
        await page.waitForTimeout(5000);

        const timeframeTrigger = page.locator('[data-qa="search-period-menu"]').first();
        if (await timeframeTrigger.count() > 0) {
            await timeframeTrigger.click();
            await page.waitForTimeout(1200);
            const optionWeek = page.locator('span', { hasText: 'За неделю' }).first();
            await optionWeek.click();
            await page.waitForTimeout(3000);
        }

        const itemsPerPageTrigger = page.locator('div[role="combobox"]', { hasText: /вакансий/ }).first();
        if (await itemsPerPageTrigger.count() > 0) {
            await itemsPerPageTrigger.click();
            await page.waitForTimeout(1200);
            const option100 = page.locator('span', { hasText: '100 вакансий' }).first();
            await option100.click();
            await page.waitForTimeout(4000);
        }

        while (hasNextPage) {
            console.log(`Processing extraction layers on page: ${pageIndex}`);
            socket.emit('status_update', { message: `Reading results page index ${pageIndex}...` });
            
            await page.waitForTimeout(3000);
            await humanSmoothScroll(page);
            await page.waitForTimeout(1500);

            const cardsLocator = page.locator('article[data-qa="vacancy-serp__vacancy"]');
            const cardsCount = await cardsLocator.count();
            const currentPageBatch = [];

            for (let i = 0; i < cardsCount; i++) {
                try {
                    const card = cardsLocator.nth(i);
                    
                    const titleLocator = card.locator('[data-qa="serp-item__title-text"]');
                    const titleText = await titleLocator.count() > 0 ? await titleLocator.first().innerText() : "Hidden Title";

                    const salaryLocator = card.locator('[class*="compensation-labels"], [data-qa*="compensation"], data[value]');
                    const salaryText = await salaryLocator.count() > 0 ? await salaryLocator.first().innerText() : "Not Specified";

                    const companyLocator = card.locator('[data-qa="vacancy-serp__vacancy-employer"]');
                    const companyText = await companyLocator.count() > 0 ? await companyLocator.first().innerText() : "Confidential Employer";

                    const addressLocator = card.locator('[class*="vacancy-address"], [data-qa="vacancy-serp__vacancy-address"]');
                    let addressText = "Location Not Stated";
                    if (await addressLocator.count() > 0) {
                        addressText = await addressLocator.first().innerText();
                    }

                    const linkLocator = card.locator('a[data-qa="serp-item__title"]');
                    const rawLink = await linkLocator.count() > 0 ? await linkLocator.first().getAttribute('href') : "";
                    
                    // Fixed index [0] to extract base string cleanly
                    const cleanJobLink = rawLink ? rawLink.split('?')[0] : "";

                    let displaySalary = salaryText.trim().replace(/\s+/g, ' ');
                    if (displaySalary !== "Not Specified") {
                        const cleanTextMatch = displaySalary.match(/^.*?(?=Опыт|Выплаты|Без опыта)/i);
                        if (cleanTextMatch && cleanTextMatch[0]) {
                            displaySalary = cleanTextMatch[0].trim();
                        }
                    }

                    const itemObject = {
                        uid: globalCounterUid++,
                        title: titleText.trim(),
                        company: companyText.trim(),
                        salary_display: displaySalary,
                        address: addressText.trim().replace(/\s+/g, ' '),
                        link: cleanJobLink.startsWith('/') ? `https://hh.ru${cleanJobLink}` : cleanJobLink
                    };

                    currentPageBatch.push(itemObject);
                    allScrapedVacancies.push(itemObject);
                } catch (cardError) {
                    console.log(`Skipped one broken listing row on index element ${i}: ${cardError.message}`);
                }
            }

            socket.emit('page_data_stream', { vacancies: currentPageBatch });

            const nextTargetPageNumber = pageIndex + 1;
            const targetPageLocator = page.locator(`[data-qa="pager-page"]`, { hasText: String(nextTargetPageNumber) }).first();
            
            if ((await targetPageLocator.count()) > 0) {
                await targetPageLocator.scrollIntoViewIfNeeded({ behavior: 'smooth' });
                await page.waitForTimeout(1000); 

                const nextRelativePath = await targetPageLocator.getAttribute('href');
                const nextAbsoluteUrl = nextRelativePath.startsWith('/') ? "https://hh.ru" + nextRelativePath : nextRelativePath;
                
                await page.goto(nextAbsoluteUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
                pageIndex++;
            } else {
                hasNextPage = false;
            }
        }
        socket.emit('status_update', { message: 'Crawl pipeline finished successfully!', done: true });
        
        return allScrapedVacancies;

    } catch (err) {
        console.error(`Scraper module loop exception: ${err.message}`);
        socket.emit('status_update', { message: `Crashed: ${err.message}`, done: true });
        return allScrapedVacancies;
    } finally {
        await context.close();
    }
}

module.exports = { executeOnDemandScrape };
