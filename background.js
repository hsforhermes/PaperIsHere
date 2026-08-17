/**
 * PaperIsHere - Background Service Worker
 * Ultimate Bulletproof Edition with Dynamic Download Locations
 */

let currentTabMetadata = {};
let activeDownloads = {}; 

const fallbackSciHubs = ["https://sci-hub.st", "https://sci-hub.ru", "https://sci-hub.se"];
const fallbackLibgens = ["https://libgen.li", "https://libgen.vg", "https://libgen.rs"];

async function checkUrl(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        return false;
    }
}

async function findActiveMirror(urls) {
    for (const url of urls) {
        if (await checkUrl(url)) return url;
    }
    return urls[0];
}

async function fetchDynamicSciHubs() {
    try {
        const response = await fetch('https://sci-hub.pub/');
        const htmlText = await response.text();
        const cleanHtml = htmlText.replace(/<(del|s|strike)[^>]*>[\s\S]*?<\/\1>/gi, '');
        const regex = /href=["'](https?:\/\/(?:sci-hub\.[a-zA-Z]{2,4}))\/?["']/gi;
        let mirrors = [];
        let match;
        while ((match = regex.exec(cleanHtml)) !== null) mirrors.push(match[1].toLowerCase());
        const uniqueMirrors = [...new Set(mirrors)];
        return uniqueMirrors.length > 0 ? uniqueMirrors : fallbackSciHubs;
    } catch (error) {
        return fallbackSciHubs;
    }
}

async function fetchDynamicLibgens() {
    try {
        const response = await fetch('https://librarygenesis.net/');
        const htmlText = await response.text();
        const cleanHtml = htmlText.replace(/<(del|s|strike)[^>]*>[\s\S]*?<\/\1>/gi, '');
        const regex = /href=["'](https?:\/\/(?:libgen\.[a-zA-Z]{2,4}))\/?["']/gi;
        let mirrors = [];
        let match;
        while ((match = regex.exec(cleanHtml)) !== null) mirrors.push(match[1].toLowerCase());
        const uniqueMirrors = [...new Set(mirrors)];
        uniqueMirrors.sort((a, b) => {
            const format2 = ['.li', '.vg', '.lc'];
            const aIsFormat2 = format2.some(ext => a.endsWith(ext));
            const bIsFormat2 = format2.some(ext => b.endsWith(ext));
            return (bIsFormat2 === aIsFormat2) ? 0 : bIsFormat2 ? 1 : -1;
        });
        return uniqueMirrors.length > 0 ? uniqueMirrors : fallbackLibgens;
    } catch (error) {
        return fallbackLibgens;
    }
}

async function updateMirrors() {
    const scrapedSciHubs = await fetchDynamicSciHubs();
    const scrapedLibgens = await fetchDynamicLibgens();
    const activeSciHub = await findActiveMirror(scrapedSciHubs);
    const activeLibgen = await findActiveMirror(scrapedLibgens);
    await chrome.storage.local.set({ sciHubDomain: activeSciHub, libgenDomain: activeLibgen });
    return { sciHubDomain: activeSciHub, libgenDomain: activeLibgen };
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['sciHubDomain'], (res) => {
        if (!res.sciHubDomain) updateMirrors();
    });
});

function getInitials(otherNames) {
    if (!otherNames) return '';
    const names = otherNames.match(/[a-zA-Z]+/g) || [];
    return names.map(n => n.charAt(0).toUpperCase()).join('');
}

function parseLibgenText(text) {
    if (!text) return null;
    let year = "", author = "", title = "";
    
    const bibTitle = text.match(/title\s*=\s*\{([^}]+)\}/i);
    const bibAuthor = text.match(/author\s*=\s*\{([^}]+)\}/i);
    const bibYear = text.match(/year\s*=\s*\{(\d{4})\}/i);
    
    if (bibTitle && bibAuthor && bibYear) {
        title = bibTitle[1];
        author = bibAuthor[1];
        year = bibYear[1];
    } else {
        const tMatch = text.match(/Title:\s*(.+)/i);
        const aMatch = text.match(/Author\(s\):\s*(.+)/i);
        const yMatch = text.match(/Year:\s*(\d{4})/i);
        if (tMatch) title = tMatch[1].trim();
        if (aMatch) author = aMatch[1].trim();
        if (yMatch) year = yMatch[1];
    }

    if (year && author && title) {
        const nameParts = author.split(',')[0].trim().split(' ').filter(Boolean);
        const lastName = nameParts.pop().replace(/[^a-zA-Z]/g, '');
        const initials = nameParts.map(n => n.charAt(0).toUpperCase()).join('');
        
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'with', 'by', 'for', 'edition', 'volume', 'global'];
        const pascalTitle = title.replace(/[^a-zA-Z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.includes(w.toLowerCase()))
            .slice(0, 5) 
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join('');

        return {
            year: year,
            last_name: lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase(),
            other_names: initials,
            title: pascalTitle
        };
    }
    return null;
}

async function getCrossref(doi) {
    if (!doi) return null;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(`https://api.crossref.org/works/${doi}?mailto=researcher@example.com`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) return null;
        const json = await response.json();
        const item = json.message;
        
        let year = "";
        if (item['published-print']?.['date-parts']?.[0]?.[0]) year = item['published-print']['date-parts'][0][0];
        else if (item['published-online']?.['date-parts']?.[0]?.[0]) year = item['published-online']['date-parts'][0][0];
        else if (item.issued?.['date-parts']?.[0]?.[0]) year = item.issued['date-parts'][0][0];
        else if (item.created?.['date-parts']?.[0]?.[0]) year = item.created['date-parts'][0][0];
        
        const author = item.author?.[0] || {};
        const title = item.title?.[0]?.replace(/<[^>]+>/g, '') || "";
        
        if (year && author.family && title) {
            return { year: String(year), last_name: author.family, other_names: author.given || "", title: title };
        }
    } catch (error) {
        return null;
    }
    return null;
}

async function getGemini(text) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) return resolve(null);

            const prompt = `Analyze this text and extract publication metadata.
Output MUST be a valid JSON object with exactly these keys: "year", "last_name", "other_names", "title".
- "year": 4-digit publication year.
- "last_name": Exact surname of FIRST author.
- "other_names": First name and initials of FIRST author.
- "title": Convert the title into a PascalCase string of 3 to 6 core keywords. Destroy all adjectives, adverbs, prepositions, stop words, and edition numbers.
Do not use markdown blocks. Output only the raw JSON.
Text: ${text.substring(0, 4000)}`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = await apiResponse.json();
                const aiTextStr = String(data.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(aiTextStr);
                if (parsed.year && parsed.last_name && parsed.title) resolve(parsed);
                else resolve(null);
            } catch (error) {
                resolve(null);
            }
        });
    });
}

async function summarizeCrossrefTitle(title) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                const clean = title.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
                return resolve(clean);
            }
            
            const prompt = `CRITICAL TASK: Convert the following academic title into a highly condensed PascalCase string of 3 to 6 core keywords.
RULES:
1. EXTERMINATE all stop words, prepositions, conjunctions, pronouns, and edition numbers.
2. Format output as a single unbroken string in PascalCase (no spaces).
Input Title: "${title}"
Output:`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = await apiResponse.json();
                const shortTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/[^a-zA-Z0-9]/g, '') || "";
                
                if (shortTitle.length < 5) throw new Error("Title too short");
                resolve(shortTitle);
            } catch (error) {
                const fallback = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 5).join('');
                resolve(fallback);
            }
        });
    });
}

async function getSaveFolder() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['saveFolder'], (res) => {
            resolve(res.saveFolder || 'Renamed Papers');
        });
    });
}

async function generateFinalFilename(doi, isbn, text, originalFilename) {
    let data = null;
    let isFromCrossref = false;
    
    if (text && (text.includes('@book') || text.includes('Publisher:'))) {
        data = parseLibgenText(text);
    }
    
    if (!data && doi) {
        data = await getCrossref(doi);
        if (data) isFromCrossref = true;
    }
    
    if (!data && text) {
        data = await getGemini(text);
    }

    let safeOriginalName = (originalFilename || "Unknown_File.pdf").split('?')[0]; 
    let fileExt = "pdf";
    const extMatch = safeOriginalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
        const potentialExt = extMatch[1].toLowerCase();
        if (potentialExt !== "php" && potentialExt !== "html") fileExt = potentialExt;
    }

    const folder = await getSaveFolder();

    if (data) {
        let cleanLastName = data.last_name.replace(/[^a-zA-Z]/g, '');
        cleanLastName = cleanLastName.charAt(0).toUpperCase() + cleanLastName.slice(1).toLowerCase();
        const initials = getInitials(data.other_names);
        
        let processedTitle = data.title;
        if (isFromCrossref) processedTitle = await summarizeCrossrefTitle(data.title);
        else processedTitle = processedTitle.replace(/[^a-zA-Z0-9]/g, '');
        
        const finalName = `${data.year}${cleanLastName}${initials}-${processedTitle}`.substring(0, 150);
        return `${folder}/${finalName}.${fileExt}`;
    }
    
    let fallbackName = safeOriginalName.replace(/[^a-zA-Z0-9.\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!fallbackName.includes('.')) fallbackName += `.${fileExt}`;
    return `${folder}/${fallbackName}`;
}

async function fallbackBlobDownload(url, filename, sendResponse) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const blob = await response.blob();
        if (blob.size < 5000) throw new Error("FILE_TOO_SMALL");
        
        const reader = new FileReader();
        reader.onloadend = function() {
            chrome.downloads.download({ url: reader.result, filename: filename, saveAs: false }, (downloadId) => {
                if (downloadId) sendResponse({ success: true, filename: filename });
                else sendResponse({ success: false, error: "CHROME_BLOCKED" });
            });
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        sendResponse({ success: false, error: error.name === "AbortError" ? "TIMEOUT" : error.message });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "storeMetadata" && sender.tab) {
        currentTabMetadata[sender.tab.id] = { doi: message.doi, isbn: message.isbn, text: message.text };
    }
    
    if (message.action === "checkUnpaywall") {
        fetch(`https://api.unpaywall.org/v2/${message.doi}?email=researcher@example.com`)
            .then(res => res.json())
            .then(data => sendResponse({ url: data.best_oa_location?.url_for_pdf }))
            .catch(() => sendResponse({ url: null }));
        return true; 
    }
    
    if (message.action === "pingMirrors") {
        updateMirrors().then((result) => sendResponse({ status: "done", data: result }));
        return true; 
    }

    if (message.action === "triggerDirectDownload") {
        (async () => {
            try {
                const safeUrl = message.url || "";
                let originalFilename = "Unknown.pdf";
                try { originalFilename = new URL(safeUrl).pathname.split('/').pop() || "Unknown.pdf"; } catch (e) { originalFilename = safeUrl.split('/').pop(); }
                
                const filename = await generateFinalFilename(message.doi, message.isbn, message.text, originalFilename);
                activeDownloads[safeUrl] = filename;
                
                try {
                    chrome.downloads.download({ url: safeUrl, saveAs: false }, (downloadId) => {
                        if (chrome.runtime.lastError || !downloadId) {
                            fallbackBlobDownload(safeUrl, filename, sendResponse);
                        } else {
                            sendResponse({ success: true, filename: filename });
                        }
                    });
                } catch (syncError) {
                    fallbackBlobDownload(safeUrl, filename, sendResponse);
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; 
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const targetUrl = item.url;
    const finalUrl = item.finalUrl;
    
    let forcedName = activeDownloads[targetUrl] || (finalUrl && activeDownloads[finalUrl]);
    
    if (forcedName) {
        delete activeDownloads[targetUrl];
        if (finalUrl) delete activeDownloads[finalUrl];
        suggest({ filename: forcedName, conflictAction: 'uniquify' });
        return true;
    }

    chrome.storage.local.get(['saveFolder'], (folderRes) => {
        const folder = folderRes.saveFolder || 'Renamed Papers';
        
        if (item.filename.startsWith(`${folder}/`)) {
            suggest({ filename: item.filename, conflictAction: 'uniquify' });
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tabId = tabs[0]?.id;
            const meta = currentTabMetadata[tabId] || Object.values(currentTabMetadata).pop() || {};
            
            if (meta.doi || meta.isbn || item.url.includes("libgen") || item.url.includes("sci-hub")) {
                try {
                    const filename = await generateFinalFilename(meta.doi, meta.isbn, meta.text, item.filename);
                    suggest({ filename: filename, conflictAction: 'uniquify' });
                } catch (e) {
                    suggest({ filename: item.filename });
                }
            } else {
                suggest({ filename: item.filename });
            }
        });
    });
    return true; 
});