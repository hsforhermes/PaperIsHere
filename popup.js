document.addEventListener('DOMContentLoaded', () => {
    const saveLocationInput = document.getElementById('saveLocation');
    const namingStyleHidden = document.getElementById('namingStyle');
    const sciHubInput = document.getElementById('sciHubDomain');
    const libgenInput = document.getElementById('libgenDomain');
    const nexusBotInput = document.getElementById('nexusBot');
    const apiKeyInput = document.getElementById('apiKey');
    
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
    const toggleText = toggleAdvancedBtn.querySelector('span');
    const advancedOptionsDiv = document.getElementById('advancedOptions');
    
    const dropdownWrapper = document.getElementById('namingDropdown');
    const selectBox = dropdownWrapper.querySelector('.custom-select');
    const selectTrigger = dropdownWrapper.querySelector('.custom-select-trigger');
    const optionsContainer = dropdownWrapper.querySelector('.custom-options');
    const optionsList = dropdownWrapper.querySelectorAll('.custom-option');

    selectBox.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsContainer.classList.toggle('open');
        selectBox.classList.toggle('active');
    });

    optionsList.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTrigger.textContent = option.textContent;
            namingStyleHidden.value = option.getAttribute('data-value');
            
            optionsList.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            optionsContainer.classList.remove('open');
            selectBox.classList.remove('active');
        });
    });

    document.addEventListener('click', () => {
        optionsContainer.classList.remove('open');
        selectBox.classList.remove('active');
    });

    function showStatus(message, color = '#7851A9') {
        statusDiv.style.color = color;
        statusDiv.textContent = message;
        setTimeout(() => statusDiv.textContent = '', 3000);
    }

    toggleAdvancedBtn.addEventListener('click', () => {
        if (advancedOptionsDiv.style.display === 'none' || advancedOptionsDiv.style.display === '') {
            advancedOptionsDiv.style.display = 'block';
            toggleText.textContent = '- Hide Settings';
        } else {
            advancedOptionsDiv.style.display = 'none';
            toggleText.textContent = '+ Advanced Settings';
        }
    });

    chrome.storage.local.get(['saveFolder', 'namingStyle', 'sciHubDomain', 'libgenDomain', 'nexusBotUsername', 'geminiApiKey'], (result) => {
        saveLocationInput.value = result.saveFolder || 'Renamed Papers';
        if (result.sciHubDomain) sciHubInput.value = result.sciHubDomain;
        if (result.libgenDomain) libgenInput.value = result.libgenDomain;
        nexusBotInput.value = result.nexusBotUsername || 'sks7777777nexusbot';
        if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
        
        if (result.namingStyle) {
            namingStyleHidden.value = result.namingStyle;
            const activeOption = Array.from(optionsList).find(opt => opt.getAttribute('data-value') === result.namingStyle);
            if (activeOption) {
                selectTrigger.textContent = activeOption.textContent;
                activeOption.classList.add('selected');
            }
        }
    });

    saveBtn.addEventListener('click', () => {
        let folder = saveLocationInput.value.trim().replace(/^\/|\/$/g, '').replace(/[<>:"|?*]/g, '');
        if (!folder) folder = 'Renamed Papers';
        
        let sciHub = sciHubInput.value.trim().replace(/\/$/, '');
        if (!sciHub) sciHub = "https://sci-hub.st";

        let libgen = libgenInput.value.trim().replace(/\/$/, '');
        if (!libgen) libgen = "https://libgen.li";

        let nexus = nexusBotInput.value.trim().replace('@', '');
        if (!nexus) nexus = 'sks7777777nexusbot';
        
        chrome.storage.local.set({ 
            saveFolder: folder,
            namingStyle: namingStyleHidden.value,
            sciHubDomain: sciHub,
            libgenDomain: libgen,
            nexusBotUsername: nexus,
            geminiApiKey: apiKeyInput.value.trim()
        }, () => {
            showStatus('SYSTEM UPDATED');
            setTimeout(() => {
                advancedOptionsDiv.style.display = 'none';
                toggleText.textContent = '+ Advanced Settings';
            }, 500);
        });
    });
});