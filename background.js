let currentTabMetadata = {};
let globalLastKnownMetadata = { doi: null, isbn: null, text: null };
let activeDownloads = {}; 

const STOP_WORDS = [
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'with', 'by', 'for', 'to', 'at', 
    'from', 'into', 'during', 'field', 'study', 'review', 'analysis', 'research', 
    'paper', 'perspective', 'approach', 'towards', 'about', 'some', 'their', 'still', 'mapping', 'general', 'miscellaneous'
];

const fallbackSciHubs = ["https://sci-hub.st", "https://sci-hub.ru", "https://sci-hub.se"];
const fallbackLibgens = ["https://libgen.li", "https://libgen.vg", "https://libgen.rs"];

function getSystemPrompt(style) {
    let outputFormat = "";
    let specificRules = "";
    let exampleOutput = "";

    const SMART_KEYWORD_RULE = "CRITICAL KEYWORD EXTRACTION ALGORITHM:\nStep 1: Identify the academic field (e.g., Strategic Management, Economics) from the context.\nStep 2: Scan the input for Author-Provided Keywords or classifications (e.g., JEL).\nStep 3: Extract ONLY the core scientific variables, theoretical contexts, and target populations (e.g., 'ownership', 'family-firms', 'social-context').\nStep 4: STRICTLY EXCLUDE metaphorical phrases (e.g., 'married to the firm'), generic study words ('investigation', 'large-scale', 'evidence', 'study', 'analysis', 'effect', 'impact'), and prepositions.";

    if (style === "pascal") {
        outputFormat = "[YYYY]-[AuthorLastName][Initials]-[Keyword1Keyword2Keyword3].pdf";
        specificRules = "2. FORMAT: 4-digit year. ONE hyphen. Author's last name (capitalized), initials. ONE hyphen. Then 3-6 core keywords in PascalCase (fused together without spaces or hyphens).";
        exampleOutput = "2015-BelenzonS-SocialContextOwnershipFamilyFirms.pdf";
    } else if (style === "date-kebab") {
        outputFormat = "[YYYYMMDD]-[AuthorLastName][Initials]-[keyword1]_[keyword2]_[keyword3].pdf";
        specificRules = "2. FORMAT: Exact date YYYYMMDD (default month/day to 01). ONE hyphen. Author's last name (capitalized), initials. ONE hyphen. Then 3-6 core keywords in LOWERCASE separated by underscores (snake_case).";
        exampleOutput = "20150921-BelenzonS-social_context_ownership_family_firms.pdf";
    } else if (style === "model1") {
        outputFormat = "[YYYY]_[FamilyNameInitials]_[Extracted-Keywords].pdf";
        specificRules = "2. DELIMITERS: Use underscores (_) to separate major blocks. Use hyphens (-) to separate keywords. NEVER use spaces.\n3. FORMAT: Year _ Author FamilyName and Initials _ kebab-case keywords.\n4. VERSIONING: ONLY append a version (e.g., _V01, _V10Final) at the end IF explicitly mentioned in the input text.";
        exampleOutput = "2015_BelenzonS_social-context-ownership-family-firms.pdf";
    } else if (style === "model2") {
        outputFormat = "[YYYYMMDD]_[Project-Name]_[Document-Type].pdf";
        specificRules = "2. DELIMITERS: Use underscores (_) to separate major blocks. Use hyphens (-) to separate keywords. NEVER use spaces.\n3. FORMAT: YYYYMMDD _ kebab-case Project Name/Keywords _ Document-Type (e.g., methodology, design).\n4. VERSIONING: ONLY append a version (e.g., _V01Draft) at the end IF explicitly mentioned in the text.";
        exampleOutput = "20260821_entrepreneur-resilience_methodology-design.pdf";
    } else if (style === "model3") {
        outputFormat = "[YYYYMMDD]_[Event-or-Report-Description].pdf";
        specificRules = "2. DELIMITERS: Use underscores (_) to separate major blocks. Use hyphens (-) to separate words. NEVER use spaces.\n3. FORMAT: YYYYMMDD _ kebab-case description.\n4. VERSIONING: ONLY append a version at the end IF explicitly mentioned.";
        exampleOutput = "20260821_development-progress-report.pdf";
    } else { // default kebab (now snake_case)
        outputFormat = "[YYYY]-[AuthorLastName][Initials]-[keyword1]_[keyword2]_[keyword3].pdf";
        specificRules = "2. FORMAT: 4-digit year. ONE hyphen. Author's last name (capitalized), initials. ONE hyphen. Then 3-6 core keywords in LOWERCASE separated by underscores (snake_case).";
        exampleOutput = "2015-BelenzonS-social_context_ownership_family_firms.pdf";
    }

    return `You are an expert Data Librarian and File Management AI. Your task is to rename document titles into strict, standardized file names based on institutional conventions.

INPUT:
You will receive metadata containing the title, authors, keywords, publisher data, and publication date.

OUTPUT FORMAT:
${outputFormat}

STRICT RULES:
1. ONLY output the final filename string. Do not provide conversational text.
${specificRules}
5. STOP WORDS REMOVAL: Aggressively remove all stop words (the, a, in, of, on, miscellaneous).
6. SANITIZATION: Remove special characters (* $ \ / < > | " ? [ ] ; = +). Replace "&" with "And".
${SMART_KEYWORD_RULE}

EXAMPLE OUTPUT:
${exampleOutput}`;
}

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
        return [...new Set(mirrors)].length > 0 ? [...new Set(mirrors)] : fallbackSciHubs;
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
        return [...new Set(mirrors)].length > 0 ? [...new Set(mirrors)] : fallbackLibgens;
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
        .filter(w => !STOP_WORDS.includes(w.toLowerCase()));
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

        return {
            year: year,
            full_date: `${year}0101`,
            last_name: lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase(),
            other_names: initials,
            title: title
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
        
        let dateParts = item['published-print']?.['date-parts']?.[0] 
                     || item['published-online']?.['date-parts']?.[0] 
                     || item.issued?.['date-parts']?.[0] 
                     || item.created?.['date-parts']?.[0];
        
        let year = "", month = "01", day = "01", full_date = "";
        if (dateParts) {
            year = String(dateParts[0]);
            if (dateParts[1]) month = String(dateParts[1]).padStart(2, '0');
            if (dateParts[2]) day = String(dateParts[2]).padStart(2, '0');
            full_date = `${year}${month}${day}`;
        }
        
        const author = item.author?.[0] || {};
        const title = item.title?.[0]?.replace(/<[^>]+>/g, '') || "";
        
        if (year && author.family && title) {
            return { year: year, full_date: full_date, last_name: author.family, other_names: author.given || "", title: title };
        }
    } catch (error) { return null; }
    return null;
}

function generateFallbackName(data, style, fileExt) {
    let cleanLastName = data.last_name.replace(/[^a-zA-Z]/g, '');
    cleanLastName = cleanLastName.charAt(0).toUpperCase() + cleanLastName.slice(1).toLowerCase();
    const initials = getInitials(data.other_names);
    let dateStr = data.year;
    
    let cleanWordsArray = smartTokenizeAndFilter(data.title);
    let keywordsPart = "";
    
    if (style === "pascal") {
        keywordsPart = cleanWordsArray.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).slice(0, 6).join('');
        return `${dateStr}-${cleanLastName}${initials}-${keywordsPart}.${fileExt}`;
    } else if (style === "date-kebab") {
        dateStr = data.full_date || `${data.year}0101`; 
        keywordsPart = cleanWordsArray.map(w => w.toLowerCase()).slice(0, 6).join('_');
        return `${dateStr}-${cleanLastName}${initials}-${keywordsPart}.${fileExt}`;
    } else if (style === "model1") {
        keywordsPart = cleanWordsArray.map(w => w.toLowerCase()).slice(0, 6).join('-');
        return `${dateStr}_${cleanLastName}${initials}_${keywordsPart}.${fileExt}`;
    } else if (style === "model2") {
        dateStr = data.full_date || `${data.year}0101`; 
        keywordsPart = cleanWordsArray.map(w => w.toLowerCase()).slice(0, 5).join('-');
        return `${dateStr}_${keywordsPart}_document.${fileExt}`;
    } else if (style === "model3") {
        dateStr = data.full_date || `${data.year}0101`; 
        keywordsPart = cleanWordsArray.map(w => w.toLowerCase()).slice(0, 5).join('-');
        return `${dateStr}_${keywordsPart}_report.${fileExt}`;
    } else {
        keywordsPart = cleanWordsArray.map(w => w.toLowerCase()).slice(0, 6).join('_');
        return `${dateStr}-${cleanLastName}${initials}-${keywordsPart}.${fileExt}`;
    }
}

async function callGemini(inputText, style) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], async (result) => {
            const apiKey = result.geminiApiKey;
            if (!apiKey) return resolve(null);

            const finalPrompt = `${getSystemPrompt(style)}\n\nInput: ${inputText.substring(0, 4000)}`;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const data = await apiResponse.json();
                
                let aiResult = String(data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
                aiResult = aiResult.replace(/```/g, '').replace(/json/gi, '').trim();
                
                if (aiResult.length > 5) resolve(aiResult);
                else resolve(null);
            } catch (error) { resolve(null); }
        });
    });
}

async function generateFinalFilename(doi, isbn, text, originalFilename) {
    let fileExt = "pdf";
    let safeOriginalName = (originalFilename || "Unknown_File.pdf").split('?')[0]; 
    try { safeOriginalName = decodeURIComponent(safeOriginalName); } catch(e) {}
    
    const extMatch = safeOriginalName.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
        const potentialExt = extMatch[1].toLowerCase();
        if (potentialExt !== "php" && potentialExt !== "html") fileExt = potentialExt;
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(['saveFolder', 'namingStyle'], async (res) => {
            const folder = res.saveFolder || 'Renamed Papers';
            const style = res.namingStyle || 'kebab';
            let finalName = null;
            let crossrefData = null;

            if (text && (text.includes('@book') || text.includes('Publisher:'))) {
                const data = parseLibgenText(text);
                if (data) finalName = generateFallbackName(data, style, fileExt);
            }
            
            if (!finalName && doi) {
                crossrefData = await getCrossref(doi);
                if (crossrefData) {
                    const structuredInput = `Title: "${crossrefData.title}"\nAuthor: ${crossrefData.last_name}, ${crossrefData.other_names}\nDate: ${crossrefData.full_date || crossrefData.year}\nContext: ${text.substring(0, 1500)}`;
                    finalName = await callGemini(structuredInput, style);
                    if (!finalName) finalName = generateFallbackName(crossrefData, style, fileExt);
                }
            }

            if (!finalName && text) {
                let inputStr = text.substring(0, 3000);
                if (safeOriginalName && safeOriginalName !== "Unknown_File.pdf") {
                    inputStr = `Target Document Hint: ${safeOriginalName}\n\nContext Data:\n${inputStr}`;
                }
                finalName = await callGemini(inputStr, style);
            }

            if (finalName) {
                finalName = finalName.replace(/\.pdf$/i, '') + `.${fileExt}`;
                resolve(`${folder}/${finalName}`);
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
        
        if (message.doi || message.isbn) {
            const isSamePaper = (message.doi === globalLastKnownMetadata.doi) || (message.isbn === globalLastKnownMetadata.isbn);
            const isPoorText = (!message.text || message.text.length < 300);
            const hasRichGlobal = (globalLastKnownMetadata.text && globalLastKnownMetadata.text.length >= 300);
            
            if (!(isSamePaper && isPoorText && hasRichGlobal)) {
                globalLastKnownMetadata = { doi: message.doi, isbn: message.isbn, text: message.text };
            }
        }
    }
    
    if (message.action === "checkUnpaywall") {
        fetch(`[https://api.unpaywall.org/v2/$](https://api.unpaywall.org/v2/$){message.doi}?email=researcher@example.com`)
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
                
                let activeDoi = message.doi;
                if (!activeDoi) {
                    const urlDoiMatch = safeUrl.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
                    if (urlDoiMatch) activeDoi = urlDoiMatch[1].replace(/[.;,]$/, '').replace(/\.pdf$/i, '');
                }

                let originalFilename = "Unknown.pdf";
                try { 
                    originalFilename = new URL(safeUrl).pathname.split('/').pop() || "Unknown.pdf"; 
                } catch (e) { 
                    originalFilename = safeUrl.split('/').pop(); 
                }
                try { originalFilename = decodeURIComponent(originalFilename); } catch(e){}
                
                const filename = await generateFinalFilename(activeDoi, message.isbn, message.text, originalFilename);
                activeDownloads[safeUrl] = filename;
                
                try {
                    chrome.downloads.download({ url: safeUrl, saveAs: false }, (downloadId) => {
                        if (chrome.runtime.lastError || !downloadId) fallbackBlobDownload(safeUrl, filename, sendResponse);
                        else sendResponse({ success: true, filename: filename });
                    });
                } catch (syncError) { fallbackBlobDownload(safeUrl, filename, sendResponse); }
            } catch (error) { sendResponse({ success: false, error: error.message }); }
        })();
        return true; 
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const targetUrl = item.url;
    const finalUrl = item.finalUrl || targetUrl;
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
            
            if (!meta || (!meta.doi && !meta.isbn) || 
               (meta.doi === globalLastKnownMetadata.doi && meta.text && meta.text.length < 300)) {
                meta = globalLastKnownMetadata || {};
            }
            
            const urlDoiMatch = finalUrl.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
            const extractedDoi = urlDoiMatch ? urlDoiMatch[1].replace(/[.;,]$/, '').replace(/\.pdf$/i, '') : null;
            
            const activeDoi = meta.doi || extractedDoi;
            const activeIsbn = meta.isbn;
            const activeText = meta.text;
            
            if (activeDoi || activeIsbn || item.filename.toLowerCase().endsWith('.pdf')) {
                try {
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));
                    const filename = await Promise.race([
                        generateFinalFilename(activeDoi, activeIsbn, activeText, item.filename),
                        timeoutPromise
                    ]);
                    suggest({ filename: filename, conflictAction: 'uniquify' });
                } catch (e) { 
                    let safeRawName = item.filename.split('?')[0];
                    try { safeRawName = decodeURIComponent(safeRawName); } catch(err){}
                    safeRawName = safeRawName.replace(/[^a-zA-Z0-9.\-]/g, ' ').replace(/\s+/g, ' ').trim();
                    suggest({ filename: `${folder}/${safeRawName}`, conflictAction: 'uniquify' }); 
                }
            } else { suggest({ filename: item.filename }); }
        });
    });
    return true; 
});