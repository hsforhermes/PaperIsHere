document.addEventListener('DOMContentLoaded', () => {
    const saveLocationInput = document.getElementById('saveLocation');
    const nexusBotInput = document.getElementById('nexusBot');
    const apiKeyInput = document.getElementById('apiKey');
    
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
    const toggleText = toggleAdvancedBtn.querySelector('span');
    const advancedOptionsDiv = document.getElementById('advancedOptions');
    
    function showStatus(message, color = '#7851A9') {
        statusDiv.style.color = color;
        statusDiv.textContent = message;
        setTimeout(() => statusDiv.textContent = '', 3000);
    }

    // باز و بسته شدن خشن و مینیمالِ بخش پیشرفته
    toggleAdvancedBtn.addEventListener('click', () => {
        if (advancedOptionsDiv.style.display === 'none' || advancedOptionsDiv.style.display === '') {
            advancedOptionsDiv.style.display = 'block';
            toggleText.textContent = '- Hide Settings';
        } else {
            advancedOptionsDiv.style.display = 'none';
            toggleText.textContent = '+ Advanced Settings';
        }
    });

    // Load saved settings
    chrome.storage.local.get(['saveFolder', 'nexusBotUsername', 'geminiApiKey'], (result) => {
        saveLocationInput.value = result.saveFolder || 'Renamed Papers';
        nexusBotInput.value = result.nexusBotUsername || 'sks7777777nexusbot';
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        let folder = saveLocationInput.value.trim().replace(/^\/|\/$/g, '').replace(/[<>:"|?*]/g, '');
        if (!folder) folder = 'Renamed Papers';
        
        let nexus = nexusBotInput.value.trim().replace('@', '');
        if (!nexus) nexus = 'sks7777777nexusbot';
        
        chrome.storage.local.set({ 
            saveFolder: folder,
            nexusBotUsername: nexus,
            geminiApiKey: apiKeyInput.value.trim()
        }, () => {
            showStatus('SYSTEM UPDATED');
            
            // بستن خودکار تنظیمات پس از ذخیره
            setTimeout(() => {
                advancedOptionsDiv.style.display = 'none';
                toggleText.textContent = '+ Advanced Settings';
            }, 500);
        });
    });
});