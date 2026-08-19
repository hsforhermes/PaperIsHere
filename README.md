# 📄 PaperIsHere - Smart Scholar Renamer

**PaperIsHere** is a minimalist, typography-driven Chrome Extension designed to streamline the workflow of researchers and academics. It acts as an intelligent assistant that automatically extracts metadata from academic papers and renames downloaded PDFs into a highly structured, keyword-driven format.

By leveraging the Crossref API and Google's Gemini AI, PaperIsHere converts chaotic filenames into clean, manageable strings using a strictly formatted PascalCase structure.

## ⚠️ Educational & Research Disclaimer (Legal Notice)
**This project is strictly for educational and research purposes.**
* **Not a Hacking Tool:** PaperIsHere does NOT bypass, crack, or circumvent any Digital Rights Management (DRM), paywalls, or security protocols of any publisher.
* **No Hosting or Piracy:** This extension does not host, store, or distribute any copyrighted material. It merely acts as a URL redirector and web-automation tool, saving researchers time by automating clicks and search queries on third-party platforms (e.g., Unpaywall, Google Scholar).
* **User Responsibility:** Any integration with third-party databases (like Sci-Hub or LibGen) is provided solely as a search aggregation feature. The developers of PaperIsHere do not endorse copyright infringement. Users are entirely responsible for ensuring they have the legal right or institutional access to download any material using this tool.

## ✨ Core Features
* **AI Keyword Naming:** Integrates with Gemini 1.5 Flash API to aggressively filter out stop words and academic filler, resulting in a hyper-condensed PascalCase title (e.g., `2015SuddabyG-EntrepreneurshipQualitativeConstructionDiscoveryOpportunity.pdf`).
* **Memory Shield V2:** Protects rich article metadata from being overwritten when navigating to text-sparse PDF viewer pages.
* **Crossref & Unpaywall Integration:** Prioritizes precise metadata retrieval and legal Open Access versions of academic articles.
* **Smart Fallback Download:** Employs background blob fetching to prevent browser timeout errors during standard downloads.
* **Privacy First:** Your Gemini API key is stored locally in your browser and never sent to external servers.

## 🛠️ Installation (Developer Mode)
1. Download this repository as a `.zip` file and extract it.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extracted `PaperIsHere` folder.

## ⚙️ Configuration
1. Get a free Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the PaperIsHere icon in your Chrome extensions bar.
3. Paste your API key and click **SAVE CONFIGURATION**.

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.