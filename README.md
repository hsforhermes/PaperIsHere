# 📄 PaperIsHere - Smart Scholar Renamer

**PaperIsHere** is a minimalist, typography-driven Chrome Extension designed to streamline the workflow of researchers and academics. It acts as an intelligent assistant that automatically extracts metadata from academic papers, bypasses generic PDF viewers, and renames downloaded PDFs into highly readable, database-friendly, and customizable formats.

By leveraging the Crossref API, a Semantic AI Engine (Google Gemini), and advanced DOM interception, PaperIsHere converts chaotic filenames into clean, structured strings.

## ⚠️ Educational & Research Disclaimer (Legal Notice)
**This project is strictly for educational and research purposes.**
* **Not a Hacking Tool:** PaperIsHere does NOT bypass, crack, or circumvent any Digital Rights Management (DRM), paywalls, or security protocols of any publisher.
* **No Hosting or Piracy:** This extension does not host, store, or distribute any copyrighted material. It merely acts as a URL redirector and web-automation tool, saving researchers time by automating clicks and search queries on third-party platforms.
* **User Responsibility:** Any integration with third-party databases (like Sci-Hub or LibGen) is provided solely as a search aggregation feature. The developers of PaperIsHere do not endorse copyright infringement. Users are entirely responsible for ensuring they have the legal right or institutional access to download any material using this tool.

## ✨ Core Features

* **🧠 Semantic AI Engine & Custom Models:** Integrates with the Gemini 1.5 Flash API to look past metaphorical titles and extract the *actual* scientific variables. Choose from 6 different naming formats, including hybrid `snake_case` and institutional standards:
  * *Standard:* `2024-DoeJ-artificial_intelligence_optimization.pdf`
  * *Academic:* `2023_SmithAB_quantum-computing-models_V01Draft.pdf`
  * *Report:* `20260821_project-alpha-development-report.pdf`
* **🥷 Global PDF Interceptor:** Defeats third-party PDF hijackers (like the Google Scholar PDF Reader extension). It intercepts clicks in the browser's Capture Phase, ensuring silent, native background downloads without forcing you into a new viewer tab.
* **🔗 URL DOI Extraction:** If page metadata is missing (e.g., on a search results page), the extension actively scans the clicked download URL for embedded DOIs to ensure accurate Crossref naming.
* **🛡️ Smart Paywall Detection:** Advanced logic accurately identifies restrictive paywalls on major publisher sites (e.g., Wiley, Sage), preventing false-positive direct download buttons.
* **🧠 Memory Shield V2:** Protects rich article metadata (like abstracts) from being overwritten when navigating to text-sparse PDF viewer pages.
* **🔓 Crossref & Unpaywall Integration:** Prioritizes precise metadata retrieval and legal Open Access versions of academic articles.
* **🎨 Typographic Brutalism UI:** A fully custom-designed, minimalist popup interface featuring a custom brutalist dropdown menu to keep your workflow clean and focused.

## 🛠️ Installation (Developer Mode)
1. Download this repository as a `.zip` file and extract it.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extracted `PaperIsHere` folder.

## ⚙️ Configuration
1. Get a free Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the PaperIsHere icon in your Chrome extensions bar.
3. Select your preferred **Naming Format**.
4. Open **+ ADVANCED SETTINGS**, paste your API key, and click **SAVE SETTINGS**.

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.