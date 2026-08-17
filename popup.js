/**
 * PaperIsHere - Popup Script
 * Handles UI interactions, folder selection, and data persistence.
 */

document.addEventListener('DOMContentLoaded', () => {
    const saveLocationInput = document.getElementById('saveLocation');
    const apiKeyInput = document.getElementById('apiKey');
    const sciHubInput = document.getElementById('sciHub');
    const libgenInput = document.getElementById('libgen');
    
    const saveBtn = document.getElementById('saveBtn');
    const autoBtn = document.getElementById('autoBtn');
    const installGuideBtn = document.getElementById('installGuideBtn');
    const statusDiv = document.getElementById('status');
    
    const advToggle = document.getElementById('advToggle');
    const advContent = document.getElementById('advContent');

    advToggle.addEventListener('click', () => {
        advContent.classList.toggle('show');
        advToggle.textContent = advContent.classList.contains('show') 
            ? '▲ Hide Advanced Settings' 
            : '▼ Advanced Settings';
    });

    function showStatus(message, color = '#7851A9') {
        statusDiv.style.color = color;
        statusDiv.textContent = message;
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 3500);
    }

    // Restore cached configurations
    chrome.storage.local.get(['geminiApiKey', 'sciHubDomain', 'libgenDomain', 'saveFolder'], (result) => {
        saveLocationInput.value = result.saveFolder || 'Renamed Papers';
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
        sciHubInput.value = result.sciHubDomain || 'https://sci-hub.st';
        libgenInput.value = result.libgenDomain || 'https://libgen.li';
    });

    // Save inputs
    saveBtn.addEventListener('click', () => {
        // Sanitize folder name (remove leading/trailing slashes and weird characters)
        let folder = saveLocationInput.value.trim().replace(/^\/|\/$/g, '').replace(/[<>:"|?*]/g, '');
        if (!folder) folder = 'Renamed Papers';
        
        const apiKey = apiKeyInput.value.trim();
        const sciHub = sciHubInput.value.trim().replace(/\/$/, "");
        const libgen = libgenInput.value.trim().replace(/\/$/, "");

        chrome.storage.local.set({ 
            saveFolder: folder,
            geminiApiKey: apiKey,
            sciHubDomain: sciHub,
            libgenDomain: libgen
        }, () => {
            showStatus('SUCCESS: CONFIG SAVED');
        });
    });

    autoBtn.addEventListener('click', () => {
        showStatus('PINGING SERVERS...', '#000000');
        chrome.runtime.sendMessage({ action: "pingMirrors" }, () => {
            chrome.storage.local.get(['sciHubDomain', 'libgenDomain'], (res) => {
                if (res.sciHubDomain) sciHubInput.value = res.sciHubDomain;
                if (res.libgenDomain) libgenInput.value = res.libgenDomain;
                showStatus('SUCCESS: MIRRORS UPDATED');
            });
        });
    });

    installGuideBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/' });
    });
});