/**
 * PaperIsHere - Background Service Worker
 * Bulletproof Naming v2.0.5: Protected Global Memory & Safe Blob Download
 */

let currentTabMetadata = {};
let globalLastKnownMetadata = { doi: null, isbn: null, text: null };
let activeDownloads = {}; 

const STOP_WORDS = [
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'with', 'by', 'for', 'to', 'at', 
    'from', 'into', 'during', 'field', 'study', 'review', 'analysis', 'research', 
    'paper', 'perspective', 'approach', 'towards', 'about', 'some', 'their', 'an'
];

const fallbackSciHubs = ["https://sci-hub.st", "https://sci-hub.ru", "https://sci-hub.se"];
const fallbackLibgens = ["https://libgen.li", "https://libgen.vg", "https://libgen.rs"];

async function checkUrl(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
        clearTimeout(timeoutId);
        return true;
    } catch (error) { return false; }
}

async function findActiveMirror(urls) {
    for (const url of urls) { if (await checkUrl(url)) return url; }
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
    } catch (error) { return fallbackSciHubs; }
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
        return uniqueMirrors.length > 0 ? uniqueMirrors : fallbackLibgens;
    } catch (error) { return fallbackLibgens; }
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

function smartTokenizeAndFilter(rawTitle) {
    if (!rawTitle) return [];
    let fusedTitle = rawTitle.replace(/[()\[\]{}]/g, ''); 
    let spacedTitle = fusedTitle.replace(/[^a-zA-Z0-9]/g, ' ');
    let wordsArray = spacedTitle.split(/\s+/).filter(w => w.length > 0);
    return wordsArray
        .filter(w => w.length > 2)
        .filter(w => !STOP_WORDS.includes(w.toLowerCase()))
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function parseLibgenText(text) {
    if (!text) return null;
    let year = "", author = "", title = "";
    
    const bibTitle = text.match(/title\s*=\s*\{([^}]+)\}/i);
    const bibAuthor = text.match(/author\s*=\s*\{([^}]+)\}/i);
    const bibYear = text.match(/year\s*=\s*\{(\d{4})\}/i);
    
    if (bibTitle && bibAuthor && bibYear) {
        title = bibTitle[1]; author = bibAuthor[1]; year = bibYear[1];
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
        const cleanWordsArray = smartTokenizeAndFilter(title);
        const pascalTitle = cleanWordsArray.slice(0, 6).join('');

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
    } catch (error) { return null; }
    return null;
}

async function getGemini(text) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) return resolve(null);

            const prompt = `CRITICAL TASK: Analyze the academic text and extract metadata.
Output MUST be a valid JSON object with exactly these keys: "year", "last_name", "other_names", "keywords".
RULES FOR "keywords":
1. Extract exactly 3 to 6 of the MOST IMPORTANT scientific core words from the title.
2. FUSE words with parentheses FIRST! Example: "(in)visible" MUST become "invisible".
3. IGNORE AND REMOVE all exact stop words (the, a, in, of, on, at, by, for, with, field, study).
4. Return a JSON Array of Strings. Each string is ONE single full word.
Example Title: "Mapping the (in)visible college(s) in the field of entrepreneurship"
Example Output for "keywords": ["Mapping", "Invisible", "Colleges", "Entrepreneurship"]
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
                
                if (parsed.year && parsed.last_name && parsed.keywords && Array.isArray(parsed.keywords)) {
                    parsed.title = smartTokenizeAndFilter(parsed.keywords.join(' ')).slice(0, 6).join('');
                    if (parsed.title.length > 3) resolve(parsed);
                    else resolve(null);
                } else {
                    resolve(null);
                }
            } catch (error) { resolve(null); }
        });
    });
}

async function summarizeCrossrefTitle(title) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) {
                return resolve(smartTokenizeAndFilter(title).slice(0, 6).join(''));
            }
            
            const prompt = `CRITICAL TASK: Analyze this academic title.
Output MUST be a JSON array of 3 to 6 core scientific keywords extracted from the title.
FUSE words with parentheses first. Example: "(in)visible" -> "invisible".
Title: "${title}"`;

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
                const aiTextStr = String(data.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsedArray = JSON.parse(aiTextStr);
                
                if (Array.isArray(parsedArray)) {
                    const cleanTitle = smartTokenizeAndFilter(parsedArray.join(' ')).slice(0, 6).join('');
                    if(cleanTitle.length > 3) resolve(cleanTitle);
                    else throw new Error("Too short");
                } else throw new Error("Not array");
            } catch (error) {
                resolve(smartTokenizeAndFilter(title).slice(0, 6).join(''));
            }
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

    return new Promise((resolve) => {
        chrome.storage.local.get(['saveFolder'], async (res) => {
            const folder = res.saveFolder || 'Renamed Papers';

            if (data) {
                let cleanLastName = data.last_name.replace(/[^a-zA-Z]/g, '');
                cleanLastName = cleanLastName.charAt(0).toUpperCase() + cleanLastName.slice(1).toLowerCase();
                const initials = getInitials(data.other_names);
                
                let processedTitle = data.title;
                if (isFromCrossref) processedTitle = await summarizeCrossrefTitle(data.title);
                
                const finalName = `${data.year}${cleanLastName}${initials}-${processedTitle}`.substring(0, 150);
                resolve(`${folder}/${finalName}.${fileExt}`);
            } else {
                let fallbackName = safeOriginalName.replace(/[^a-zA-Z0-9.\-]/g, ' ').replace(/\s+/g, ' ').trim();
                if (!fallbackName.includes('.')) fallbackName += `.${fileExt}`;
                resolve(`${folder}/${fallbackName}`);
            }
        });
    });
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
        
        // MEMORY SHIELD V2: Prevent empty viewer pages from overwriting rich abstract text 
        if (message.doi || message.isbn) {
            const isSamePaper = (message.doi === globalLastKnownMetadata.doi) || (message.isbn === globalLastKnownMetadata.isbn);
            const isPoorText = (!message.text || message.text.length < 300);
            const hasRichGlobal = (globalLastKnownMetadata.text && globalLastKnownMetadata.text.length >= 300);
            
            if (isSamePaper && isPoorText && hasRichGlobal) {
                // Do not overwrite rich text with viewer garbage. Keep global memory intact.
            } else {
                globalLastKnownMetadata = { doi: message.doi, isbn: message.isbn, text: message.text };
            }
        }
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
            let meta = currentTabMetadata[tabId];
            
            // Apply Memory Shield V2 fallback logic
            if (!meta || (!meta.doi && !meta.isbn) || 
               (meta.doi === globalLastKnownMetadata.doi && meta.text && meta.text.length < 300)) {
                meta = globalLastKnownMetadata;
            }
            
            if (meta.doi || meta.isbn || item.filename.toLowerCase().endsWith('.pdf')) {
                try {
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));
                    const filename = await Promise.race([
                        generateFinalFilename(meta.doi, meta.isbn, meta.text, item.filename),
                        timeoutPromise
                    ]);
                    suggest({ filename: filename, conflictAction: 'uniquify' });
                } catch (e) { 
                    const safeRawName = item.filename.replace(/[^a-zA-Z0-9.\-]/g, '_');
                    suggest({ filename: `${folder}/${safeRawName}`, conflictAction: 'uniquify' }); 
                }
            } else { 
                suggest({ filename: item.filename }); 
            }
        });
    });
    return true; 
});