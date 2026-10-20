const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { executeOnDemandScrape } = require('./scraper_module');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let lastSearchResultCache = [];
let activeKeywordSearched = "";

app.get('/', (req, res) => {
    const fullUIHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Live Streaming Analytics Suite</title>
        <script src="/socket.io/socket.io.js"></script>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111; margin: 0; padding: 30px; color: #eee; }
            .wrapper { max-width: 1300px; margin: 0 auto; }
            .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
            h1 { font-size: 26px; color: #fff; margin: 0 0 4px 0; }
            .subtitle { color: #8a99ad; margin: 0; font-size: 14px; }
            .export-actions { display: flex; gap: 10px; }
            .btn-export { text-decoration: none; font-size: 14px; font-weight: bold; padding: 8px 16px; border-radius: 4px; display: inline-flex; align-items: center; cursor: pointer; }
            .btn-excel { background: #217346; color: white; border: 1px solid #1e663e; }
            .btn-json { background: #333; color: white; border: 1px solid #222; }
            .search-box-panel { background: #222; padding: 20px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); margin-bottom: 20px; }
            .input-row { display: flex; gap: 12px; align-items: center; }
            .input-row input { flex: 1; padding: 10px 14px; background: #333; border: 1px solid #444; border-radius: 4px; font-size: 15px; color: #fff; outline: none; }
            .input-row button { background: #005bff; color: white; border: none; padding: 10px 20px; font-size: 15px; font-weight: bold; border-radius: 4px; cursor: pointer; }
            .input-row button:disabled { background: #444; color: #888; cursor: not-allowed; }
            #statusLogger { font-weight: bold; color: #005bff; margin-left: 5px; font-size: 14px; padding: 10px 16px; background: #1a2a3a; border-radius: 4px; display: none; }
            .table-container { background: #1a1a1a; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); overflow: hidden; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background: #2d2d2d; color: #8a99ad; font-weight: 600; padding: 12px; font-size: 13px; border-bottom: 2px solid #3d3d3d; }
            td { border-bottom: 1px solid #2a2a2a; color: #ddd; }
            tr:hover { background: #252525 !important; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header-row">
                <div>
                    <h1>On-Demand Automation Pipeline</h1>
                    <div class="subtitle">Live WebSocket stream dashboard. Rows update instantly as pages get parsed.</div>
                </div>
                <div class="export-actions" id="exportActions" style="display: none;">
                    <a href="/api/export/excel" class="btn-export btn-excel">📊 Export to Excel (.xls)</a>
                    <a href="/api/export/json" class="btn-export btn-json">⚙️ Download JSON</a>
                </div>
            </div>
            
            <div class="search-box-panel">
                <div class="input-row">
                    <input type="text" id="keywordInput" placeholder="Enter keyword..." required>
                    <button type="button" id="submitBtn" onclick="triggerLiveCrawl()">Launch Scraper</button>
                    <div id="statusLogger">Connecting Engine...</div>
                </div>
            </div>

            <h2 id="tableTitle" style="font-size: 16px; color: #fff; margin-bottom: 12px; display: none;">Data Spreadsheet View</h2>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">Index</th>
                            <th>Vacancy Title Position</th>
                            <th style="width: 220px;">Company Entity</th>
                            <th style="width: 250px;">Location Address</th>
                            <th style="width: 180px;">Salary Stated</th>
                        </tr>
                    </thead>
                    <tbody id="dataTableBody">
                        <tr>
                            <td colspan="5" id="placeholderRow" style="text-align: center; color: #8a99ad; padding: 40px; background: #1a1a1a; font-style: italic;">
                                No search query active. Enter a keyword above to watch the streaming data updates live.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script>
            const socket = io();

            socket.on('page_data_stream', (data) => {
                const placeholder = document.getElementById('placeholderRow');
                if (placeholder) placeholder.remove();
                
                const tbody = document.getElementById('dataTableBody');
                
                data.vacancies.forEach(job => {
                    const row = document.createElement('tr');
                    row.innerHTML = "<tr>" +
                        "<td style='padding: 10px 12px; font-weight: 500; font-size: 14px;'>" + job.uid + "</td>" +
                        "<td style='padding: 10px 12px; font-size: 14px; font-weight: 600;'>" +
                            "<a href='" + job.link + "' target='_blank' style='color: #38bdf8; text-decoration: none;'>" + job.title + "</a>" +
                        "</td>" +
                        "<td style='padding: 10px 12px; font-size: 14px;'>" + job.company + "</td>" +
                        "<td style='padding: 10px 12px; font-size: 13px; color: #8a99ad;'>" + job.address + "</td>" +
                        "<td style='padding: 10px 12px; font-size: 14px; font-weight: bold; color: #4ade80; white-space: nowrap;'>" + job.salary_display + "</td>" +
                    "</tr>";
                    tbody.appendChild(row);
                });
            });

            socket.on('status_update', (data) => {
                const logger = document.getElementById('statusLogger');
                logger.innerText = data.message;
                
                if (data.done) {
                    document.getElementById('submitBtn').disabled = false;
                    document.getElementById('submitBtn').innerText = 'Launch Scraper';
                    logger.style.display = 'none';
                    document.getElementById('exportActions').style.display = 'flex';
                }
            });

            function triggerLiveCrawl() {
                const query = document.getElementById('keywordInput').value;
                if (!query || query.trim() === "") return;

                document.getElementById('dataTableBody').innerHTML = '';
                document.getElementById('exportActions').style.display = 'none';
                
                const titleHeading = document.getElementById('tableTitle');
                titleHeading.style.display = 'block';
                titleHeading.innerText = 'Live Streaming View: "' + query + '"';

                document.getElementById('submitBtn').disabled = true;
                document.getElementById('submitBtn').innerText = 'Running...';
                
                const logger = document.getElementById('statusLogger');
                logger.style.display = 'inline-block';
                logger.innerText = 'Initializing browser engine...';

                fetch('/api/start-crawl', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keyword: query })
                });
            }
        </script>
    </body>
    </html>
    `;
    res.send(fullUIHtml);
});

app.post('/api/start-crawl', async (req, res) => {
    const keyword = req.body.keyword;
    res.status(200).send({ started: true });
    try {
        lastSearchResultCache = await executeOnDemandScrape(keyword, io);
    } catch (err) {
        console.error("Pipeline run hit unexpected errors:", err);
    }
});

app.get('/api/export/json', (req, res) => {
    if (!lastSearchResultCache || lastSearchResultCache.length === 0) {
        return res.status(400).send("<h1>No data available</h1><p>Please launch and complete a scrape pipeline first.</p>");
    }
    res.setHeader('Content-Disposition', 'attachment; filename=scraped_vacancies.json');
    res.json(lastSearchResultCache);
});

app.get('/api/export/excel', (req, res) => {
    if (!lastSearchResultCache || lastSearchResultCache.length === 0) {
        return res.status(400).send("<h1>No data available to export</h1><p>Please launch and complete a scrape pipeline first.</p>");
    }

    let excelContent = "Index\tVacancy Title\tCompany Entity\tLocation Address\tSalary Offered\tDirect URL Link\n";
    lastSearchResultCache.forEach(job => {
        excelContent += job.uid + "\t" + job.title + "\t" + job.company + "\t" + job.address + "\t" + job.salary_display + "\t" + job.link + "\n";
    });
    
    const buffer = Buffer.from('\ufeff' + excelContent, 'utf16le');
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-16le');
    res.setHeader('Content-Disposition', 'attachment; filename=scraped_vacancies.xls');
    res.send(buffer);
});

server.listen(PORT, () => {
    console.log(`\n================ STREAMING APP REVOLUTION ONLINE ================`);
    console.log(`Navigate your browser tab directly to: http://localhost:${PORT}`);
    console.log(`==================================================================\n`);
});